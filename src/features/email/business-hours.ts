/**
 * Horario hábil de Studio Nomade para los correos que el equipo dispara desde
 * Asana (ENTREGA NN y CONSULTA): lunes a viernes de 9:00 a 18:00, hora de
 * Santiago. Fuera de ese horario el correo no sale de inmediato: queda
 * programado para las 08:55 del siguiente día hábil, para respetar los tiempos
 * de desarrollo. Módulo puro (sin base ni red).
 */

export type BusinessHours = {
  timeZone: string;
  /** Minutos desde medianoche: desde aquí se envía de inmediato. */
  sendFromMinutes: number;
  /** Minutos desde medianoche: desde aquí se programa para el día siguiente. */
  closeMinutes: number;
  /** 0 = domingo … 6 = sábado. */
  workdays: readonly number[];
  /** Feriados en `YYYY-MM-DD` (hora local). */
  holidays: ReadonlySet<string>;
};

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timeZone: "America/Santiago",
  sendFromMinutes: 8 * 60 + 55,
  closeMinutes: 18 * 60,
  workdays: [1, 2, 3, 4, 5],
  holidays: new Set(),
};

/** Lee feriados de `NOMA_BUSINESS_HOLIDAYS` (`2026-12-08,2026-12-25`). */
export function parseHolidays(raw: string | null | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[,;\s]+/)
      .map((value) => value.trim())
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
  );
}

export function businessHoursFromEnv(
  env: Record<string, string | undefined> = process.env,
): BusinessHours {
  return {
    ...DEFAULT_BUSINESS_HOURS,
    holidays: parseHolidays(env.NOMA_BUSINESS_HOLIDAYS),
  };
}

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: WEEKDAYS[get("weekday")] ?? 0,
  };
}

/** Desfase (ms) de la zona respecto de UTC en ese instante. */
function zoneOffset(date: Date, timeZone: string) {
  const p = localParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(date.getTime() / 60_000) * 60_000;
}

/** Instante UTC de una hora local (resuelve el cambio de horario). */
export function zonedTime(
  year: number,
  month: number,
  day: number,
  minutes: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, 0, minutes);
  let result = guess - zoneOffset(new Date(guess), timeZone);
  result = guess - zoneOffset(new Date(result), timeZone);
  return new Date(result);
}

function dayKey(p: { year: number; month: number; day: number }) {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function isWorkday(p: LocalParts, hours: BusinessHours) {
  return hours.workdays.includes(p.weekday) && !hours.holidays.has(dayKey(p));
}

/** ¿Un correo disparado en este instante sale de inmediato? */
export function isWithinBusinessHours(
  date: Date,
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS,
) {
  const p = localParts(date, hours.timeZone);
  const minutes = p.hour * 60 + p.minute;
  return (
    isWorkday(p, hours) &&
    minutes >= hours.sendFromMinutes &&
    minutes < hours.closeMinutes
  );
}

/**
 * Próximo envío hábil: el mismo día a las 08:55 si aún no llega, o las 08:55
 * del siguiente día hábil (salta fines de semana y feriados).
 */
export function nextBusinessSend(
  date: Date,
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS,
): Date {
  const start = localParts(date, hours.timeZone);
  const minutes = start.hour * 60 + start.minute;
  // Día local de partida como fecha UTC "plana" para iterar sin zonas.
  const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day));
  if (!(isWorkday(start, hours) && minutes < hours.sendFromMinutes)) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  for (let i = 0; i < 31; i += 1) {
    const p = {
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
      day: cursor.getUTCDate(),
      hour: 12,
      minute: 0,
      weekday: cursor.getUTCDay(),
    };
    if (isWorkday(p, hours)) {
      return zonedTime(
        p.year,
        p.month,
        p.day,
        hours.sendFromMinutes,
        hours.timeZone,
      );
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return date;
}

/** Cuándo sale un correo disparado en `date` (`null` = de inmediato). */
export function deferredSendAt(
  date: Date,
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS,
): Date | null {
  return isWithinBusinessHours(date, hours)
    ? null
    : nextBusinessSend(date, hours);
}

/** «ENVIAR AHORA» en el comentario salta el horario hábil (urgencias). */
export function wantsImmediateSend(text: string | null | undefined) {
  return /\benviar\s+ahora\b/i.test(text ?? "");
}

/** «el viernes 13-11 a las 08:55» en la zona del estudio. */
export function formatBusinessSlot(
  date: Date,
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS,
) {
  const day = new Intl.DateTimeFormat("es-CL", {
    timeZone: hours.timeZone,
    weekday: "long",
  }).format(date);
  const p = localParts(date, hours.timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `el ${day} ${pad(p.day)}-${pad(p.month)} a las ${pad(p.hour)}:${pad(p.minute)}`;
}
