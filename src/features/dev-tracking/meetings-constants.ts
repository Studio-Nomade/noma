export const MEETING_CADENCES = [
  "weekly",
  "biweekly",
  "monthly",
  "adhoc",
] as const;
export type MeetingCadence = (typeof MEETING_CADENCES)[number];

export const CADENCE_LABELS: Record<MeetingCadence, string> = {
  weekly: "Semanal",
  biweekly: "Cada 15 días",
  monthly: "Mensual",
  adhoc: "Según hito",
};

export const WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export const MEETING_STATUSES = [
  "agendada",
  "realizada",
  "transcrita",
  "resumida",
  "minuta_enviada",
  "cancelada",
  "archivada",
] as const;
export type DevMeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_STATUS_LABELS: Record<DevMeetingStatus, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  transcrita: "Transcripción lista",
  resumida: "Resumen listo",
  minuta_enviada: "Minuta enviada",
  cancelada: "Cancelada",
  archivada: "Procesada fuera de Noma",
};

/**
 * Próxima ocurrencia de un tipo con cadencia y día fijos, en fecha local
 * (YYYY-MM-DD) a partir de `from` (también YYYY-MM-DD). Para `adhoc` o sin
 * día devuelve `from`.
 */
export function nextOccurrence(
  cadence: MeetingCadence,
  weekday: number | null,
  from: string,
): string {
  if (cadence === "adhoc" || weekday == null) return from;
  const [y, m, d] = from.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const diff = (weekday - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + (diff === 0 ? 7 : diff));
  return date.toISOString().slice(0, 10);
}
