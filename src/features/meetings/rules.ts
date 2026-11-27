/**
 * Reuniones pedidas por Slack (#noma-reuniones): reglas puras (sin red) para
 * nombres de carpeta, títulos, horarios y respuestas en el hilo.
 */

type Env = Record<string, string | undefined>;

export const MEETING_AREAS = ["B&D", "WD", "A&D", "A&A", "CE", "SN"] as const;
export type MeetingArea = (typeof MEETING_AREAS)[number];

/** Canal donde se piden las reuniones (#noma-reuniones). */
export function meetingsChannel(env: Env = process.env): string {
  return env.NOMA_SLACK_MEETINGS_CHANNEL?.trim() || "C0CMGCQBZGA";
}

/** Unidad compartida «Studio Nomade · Operations & Governance». */
export function meetingsDriveId(env: Env = process.env): string {
  return env.NOMA_MEETINGS_DRIVE_ID?.trim() || "0AFHhtBFSIRx1Uk9PVA";
}

/** Carpeta `04_OPERATIONS/05_Reuniones y Minutas`. */
export function meetingsRootFolder(env: Env = process.env): string {
  return (
    env.NOMA_MEETINGS_ROOT_FOLDER?.trim() || "11iLSc1qa6S8UtxgPa8gRIWJTV7r0QZDn"
  );
}

/** Área conocida o «SN» (interna) si no se reconoce. */
export function normalizeArea(value: string | null | undefined): MeetingArea {
  const v = (value ?? "").toUpperCase().replace(/\s+/g, "");
  const hit = MEETING_AREAS.find((a) => a.replace(/\s+/g, "") === v);
  if (hit) return hit;
  if (/^BD$|BRANDING/.test(v)) return "B&D";
  if (/^AD$|ARQUITECT|ARCHITECT/.test(v)) return "A&D";
  if (/^AA$|AUDIOVISUAL/.test(v)) return "A&A";
  if (/WEB/.test(v)) return "WD";
  if (/CLINICA|CLÍNICA/.test(v)) return "CE";
  return "SN";
}

/** «ÁREA - Cliente | Tipo de reunión» (convención de los eventos). */
export function meetingTitle(input: {
  area: string;
  client: string;
  type: string;
}): string {
  return `${input.area} - ${input.client.trim()} | ${input.type.trim()}`;
}

/** Nombre de la carpeta del cliente: mayúsculas, sin barras. */
export function clientFolderName(client: string): string {
  return client
    .trim()
    .replace(/[\\/]+/g, "-")
    .toLocaleUpperCase("es-CL");
}

/** Fecha AAAAMMDD en America/Santiago. */
export function santiagoStamp(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" })
    .format(date)
    .replace(/-/g, "");
}

/** «AAAAMMDD_Tipo de reunión». */
export function meetingFolderName(startsAt: Date, type: string): string {
  const clean = type.trim().replace(/[\\/]+/g, "-") || "Reunión";
  return `${santiagoStamp(startsAt)}_${clean}`;
}

/** Fecha + hora de America/Santiago → instante UTC. */
export function santiagoToDate(date: string, time: string): Date {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
  );
  return new Date(guess.getTime() - (asLocal - guess.getTime()));
}

/** «lunes 30 de noviembre, 11:00 a 11:30». */
export function formatSlot(startsAt: Date, durationMin: number): string {
  const end = new Date(startsAt.getTime() + durationMin * 60_000);
  const day = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(startsAt);
  const time = (d: Date) =>
    new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(d);
  return `${day}, ${time(startsAt)} a ${time(end)}`;
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const APPROVALS = new Set([
  "ok",
  "okay",
  "okey",
  "si",
  "sip",
  "dale",
  "listo",
  "agenda",
  "agendala",
  "agendalo",
  "aprobar",
  "aprobado",
  "aprobada",
  "apruebo",
  "confirmo",
  "confirmar",
  "confirmado",
  "perfecto",
  "va",
  "vamos",
  "enviala",
  "si agenda",
  "si dale",
  "ok dale",
  "ok agenda",
  "si aprobado",
  "si aprobada",
]);

/** ¿La respuesta del hilo es una aprobación sin cambios? */
export function isApproval(text: string): boolean {
  const t = fold(text);
  if (!t || t.split(" ").length > 3) return false;
  return APPROVALS.has(t);
}

/** ¿La respuesta pide cancelar? */
export function isCancel(text: string): boolean {
  const t = fold(text);
  return /^(cancelar|cancela|cancelala|anular|anula|descartar|descarta)( la reunion)?$/.test(
    t,
  );
}

/** ¿Pide procesar ya las notas (sin esperar el cron)? */
export function isProcessNow(text: string): boolean {
  return /^(procesar|procesa|minuta|haz la minuta|arma la minuta)( ahora)?$/.test(
    fold(text),
  );
}

/** Correos válidos únicos, en minúscula. */
export function uniqueEmails(list: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const raw of list) {
    const e = (raw ?? "").trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) out.add(e);
  }
  return [...out];
}

/** Para y Cc del correo de minuta: externos en Para, internos en Cc. */
export function minutesRecipients(
  attendees: string[],
  requester: string,
  studioDomain = "studionomade.cl",
): { to: string[]; cc: string[] } {
  const all = uniqueEmails(attendees).filter(
    (e) => e !== requester.toLowerCase() && !e.startsWith("operations@"),
  );
  const external = all.filter((e) => !e.endsWith(`@${studioDomain}`));
  const internal = all.filter((e) => e.endsWith(`@${studioDomain}`));
  return external.length
    ? { to: external, cc: internal }
    : { to: internal, cc: [] };
}

/** Asunto del correo de minuta: «Minuta | Cliente - Tipo - DD-MM-AAAA». */
export function minutesSubject(input: {
  client: string | null;
  type: string | null;
  title: string;
  startsAt: Date;
}): string {
  const date = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(input.startsAt)
    .replace(/\//g, "-");
  const what =
    input.client && input.type
      ? `${input.client} - ${input.type}`
      : input.title;
  return `Minuta | ${what} - ${date}`;
}
