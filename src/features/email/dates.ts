/**
 * Fechas en America/Santiago para el canal correo: nombre de sección mensual
 * ("Octubre | 2026") y resolución de fechas relativas ("lunes AM") contra la
 * fecha del correo. Módulo puro.
 */

export const STUDIO_TIME_ZONE = "America/Santiago";

export const SPANISH_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
] as const;

export type LocalDate = { year: number; month: number; day: number };

/** Año/mes/día de un instante en la zona indicada. */
export function localDateParts(
  date: Date,
  timeZone = STUDIO_TIME_ZONE,
): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Nombre de la sección mensual. Tokens: {Mes} (Octubre), {mes} (octubre),
 * {MES} (OCTUBRE), {MM} (10), {YYYY} (2026), {YY} (26).
 */
export function monthSectionName(
  template: string,
  date: Date,
  timeZone = STUDIO_TIME_ZONE,
): string {
  const { year, month } = localDateParts(date, timeZone);
  const name = SPANISH_MONTHS[month - 1];
  return template
    .replace(/\{Mes\}/g, capitalize(name))
    .replace(/\{mes\}/g, name)
    .replace(/\{MES\}/g, name.toUpperCase())
    .replace(/\{MM\}/g, String(month).padStart(2, "0"))
    .replace(/\{YYYY\}/g, String(year))
    .replace(/\{YY\}/g, String(year).slice(-2));
}

/** Para comparar nombres de sección sin depender de tildes/espacios/caja. */
export function normalizeSectionName(value: string): string {
  return foldText(value).replace(/\s*\|\s*/g, " | ");
}

export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ── Aritmética de fechas locales (sin zona: YYYY-MM-DD) ──────
function toUtc(local: LocalDate) {
  return new Date(Date.UTC(local.year, local.month - 1, local.day));
}

export function toIsoDate(local: LocalDate): string {
  return toUtc(local).toISOString().slice(0, 10);
}

function addDays(local: LocalDate, days: number): LocalDate {
  const value = toUtc(local);
  value.setUTCDate(value.getUTCDate() + days);
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function weekday(local: LocalDate) {
  return toUtc(local).getUTCDay();
}

function isValidLocal(local: LocalDate) {
  const value = toUtc(local);
  return (
    value.getUTCFullYear() === local.year &&
    value.getUTCMonth() + 1 === local.month &&
    value.getUTCDate() === local.day
  );
}

function compare(a: LocalDate, b: LocalDate) {
  return toUtc(a).getTime() - toUtc(b).getTime();
}

/**
 * Busca una fecha objetivo en texto libre en español, relativa a la fecha del
 * correo (en America/Santiago). Devuelve YYYY-MM-DD o null.
 *
 * Soporta: "hoy", "mañana", "pasado mañana", días de semana ("lunes AM",
 * "el próximo viernes"), "dd/mm[/aaaa]", "dd-mm", "15 de octubre [de 2026]",
 * "fin de mes" y "próxima semana" (lunes siguiente).
 */
export function parseRelativeDueDate(
  value: string | null | undefined,
  emailDate: Date,
  timeZone = STUDIO_TIME_ZONE,
): string | null {
  if (!value) return null;
  const text = foldText(value);
  const today = localDateParts(emailDate, timeZone);

  // dd/mm[/aaaa] o dd-mm[-aaaa]
  const numeric = text.match(
    /(?<![\d/-])(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?![\d/-])/,
  );
  if (numeric) {
    const resolved = resolveDayMonth(
      today,
      Number(numeric[1]),
      Number(numeric[2]),
      numeric[3],
    );
    if (resolved) return toIsoDate(resolved);
  }

  // "15 de octubre [de 2026]"
  const months = SPANISH_MONTHS.join("|");
  const named = text.match(
    new RegExp(
      `\\b(\\d{1,2})\\s+de\\s+(${months})(?:\\s+(?:de|del)\\s+(\\d{4}))?\\b`,
    ),
  );
  if (named) {
    const month =
      SPANISH_MONTHS.indexOf(named[2] as (typeof SPANISH_MONTHS)[number]) + 1;
    const resolved = resolveDayMonth(today, Number(named[1]), month, named[3]);
    if (resolved) return toIsoDate(resolved);
  }

  if (/\bpasado manana\b/.test(text)) return toIsoDate(addDays(today, 2));
  if (/\bfin de mes\b/.test(text)) {
    const firstNext =
      today.month === 12
        ? { year: today.year + 1, month: 1, day: 1 }
        : { year: today.year, month: today.month + 1, day: 1 };
    return toIsoDate(addDays(firstNext, -1));
  }

  // Día de la semana: siguiente ocurrencia estrictamente posterior a hoy.
  const weekdayMatch = text.match(
    /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/,
  );
  if (weekdayMatch) {
    const target = WEEKDAYS.indexOf(
      weekdayMatch[1] as (typeof WEEKDAYS)[number],
    );
    let delta = (target - weekday(today) + 7) % 7;
    if (delta === 0) delta = 7;
    return toIsoDate(addDays(today, delta));
  }

  if (/\b(proxima semana|la otra semana|semana que viene)\b/.test(text)) {
    const delta = (1 - weekday(today) + 7) % 7 || 7;
    return toIsoDate(addDays(today, delta));
  }
  // "mañana" como día (no "en la mañana" / "por la mañana" / "de la mañana").
  if (/(?<!\bla )\bmanana\b/.test(text)) {
    return toIsoDate(addDays(today, 1));
  }
  if (/\bhoy\b/.test(text)) return toIsoDate(today);
  return null;
}

function resolveDayMonth(
  today: LocalDate,
  day: number,
  month: number,
  yearText: string | undefined,
): LocalDate | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let year = yearText
    ? Number(yearText.length === 2 ? `20${yearText}` : yearText)
    : today.year;
  let candidate: LocalDate = { year, month, day };
  if (!isValidLocal(candidate)) return null;
  // Sin año explícito y ya pasada: se asume el año siguiente ("05/01" en dic).
  if (!yearText && compare(candidate, today) < 0) {
    year += 1;
    candidate = { year, month, day };
    if (!isValidLocal(candidate)) return null;
  }
  return candidate;
}

/**
 * Normaliza la fecha propuesta por la IA: acepta ISO YYYY-MM-DD dentro de
 * [fecha del correo, +1 año]; si viene texto relativo lo resuelve; si no, null.
 */
export function normalizeDueDate(
  value: string | null | undefined,
  emailDate: Date,
  timeZone = STUDIO_TIME_ZONE,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!iso) return parseRelativeDueDate(trimmed, emailDate, timeZone);
  const local = {
    year: Number(iso[1]),
    month: Number(iso[2]),
    day: Number(iso[3]),
  };
  if (!isValidLocal(local)) return null;
  const today = localDateParts(emailDate, timeZone);
  const limit = { ...today, year: today.year + 1 };
  if (compare(local, today) < 0 || compare(local, limit) > 0) return null;
  return toIsoDate(local);
}

/** "lunes 20 de octubre de 2026" (para los correos). */
export function formatSpanishDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const local = { year, month, day };
  if (!isValidLocal(local)) return isoDate;
  const names = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  return `${names[weekday(local)]} ${day} de ${SPANISH_MONTHS[month - 1]} de ${year}`;
}
