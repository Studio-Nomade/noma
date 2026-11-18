/**
 * Reglas puras para preparar un proyecto nuevo de Asana (reemplaza el Zap
 * «Crear Canal y Carpeta en Drive»):
 *
 * - El proyecto se llama «Cliente | Proyecto» y vive en el equipo (área) de
 *   Asana. Las tareas de los proyectos generales no cuentan: esos clientes se
 *   tratan en el canal general del área.
 * - Drive: en la unidad compartida del área, carpeta del cliente (en
 *   mayúsculas; se reutiliza si existe) y subcarpeta «AAAAMMDD_PROYECTO».
 * - Slack: canal «proy-cliente-proyecto». Si ya existe, se usa; si el cliente
 *   no tiene canal, se crea; si el cliente ya tiene otro canal, se pregunta al
 *   equipo («CANAL NUEVO» o «CANAL #nombre» en Asana).
 */

export type Area = {
  /** Nombre del equipo de Asana. */
  team: string;
  /** Unidad compartida de Drive del área. */
  driveId: string;
};

/** Equipos de Asana con unidad compartida (los mismos del Zap). */
export const AREAS: readonly Area[] = [
  { team: "A&A | Audiovisual & Animation", driveId: "0AG8srq1T3rH2Uk9PVA" },
  { team: "A&D | Architecture & Design", driveId: "0APVnCpxmT0AGUk9PVA" },
  { team: "B&D | Branding & Design", driveId: "0ALvyAfPdgF-MUk9PVA" },
  { team: "CE | Clínica de Emprendimientos", driveId: "0AKPhQhLwCGW1Uk9PVA" },
  { team: "WD | Web Design", driveId: "0AG84s5-OMTYHUk9PVA" },
];

/** Comparación sin tildes, mayúsculas ni espacios de más. */
export function fold(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function areaForTeam(teamName: string | null | undefined): Area | null {
  const wanted = fold(teamName);
  return AREAS.find((area) => fold(area.team) === wanted) ?? null;
}

/** «Cliente | Proyecto» → partes; null si no tiene ese formato. */
export function parseProjectName(
  name: string | null | undefined,
): { client: string; project: string } | null {
  const text = (name ?? "").replace(/\s+/g, " ").trim();
  const index = text.indexOf("|");
  if (index < 0) return null;
  const client = text.slice(0, index).trim();
  const project = text.slice(index + 1).trim();
  if (!client || !project) return null;
  return { client, project };
}

/** Parte de un nombre de canal: minúsculas, sin tildes, palabras con «_». */
export function channelSlug(value: string): string {
  return fold(value)
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Canal del proyecto: «proy-cliente-proyecto» (Slack admite 80 caracteres). */
export function projectChannelName(client: string, project: string): string {
  return `proy-${channelSlug(client)}-${channelSlug(project)}`
    .slice(0, 80)
    .replace(/[-_]+$/, "");
}

export type SlackChannel = { id: string; name: string };

/** Canales (no generales) que ya nombran al cliente. */
export function clientChannels(
  channels: readonly SlackChannel[],
  client: string,
): SlackChannel[] {
  const slug = channelSlug(client);
  if (!slug) return [];
  return channels.filter((channel) => {
    if (channel.name.startsWith("general")) return false;
    return channel.name.split("-").includes(slug);
  });
}

export type ChannelDecision =
  | { action: "use"; channel: SlackChannel }
  | { action: "create"; name: string }
  | { action: "ask"; name: string; candidates: SlackChannel[] };

/** Qué hacer con Slack para un proyecto nuevo. */
export function decideChannel(input: {
  channels: readonly SlackChannel[];
  client: string;
  project: string;
}): ChannelDecision {
  const name = projectChannelName(input.client, input.project);
  const exact = input.channels.find((channel) => channel.name === name);
  if (exact) return { action: "use", channel: exact };
  const candidates = clientChannels(input.channels, input.client);
  if (!candidates.length) return { action: "create", name };
  return { action: "ask", name, candidates };
}

/** Respuesta del equipo en Asana: «CANAL NUEVO» o «CANAL #nombre». */
export function parseChannelAnswer(
  text: string | null | undefined,
): { kind: "new" } | { kind: "existing"; name: string } | null {
  const value = (text ?? "").trim();
  if (/^CANAL\s+NUEVO\b/.test(value)) return { kind: "new" };
  const match = value.match(/^CANAL\s+#?([a-z0-9][a-z0-9_-]{0,79})\b/);
  return match ? { kind: "existing", name: match[1] } : null;
}

/** Carpeta del cliente en la unidad del área. */
export function clientFolderName(client: string): string {
  return client.replace(/\s+/g, " ").trim().toUpperCase();
}

/** Subcarpeta del proyecto: «AAAAMMDD_PROYECTO» (fecha de Santiago). */
export function projectFolderName(createdAt: Date, project: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(createdAt);
  return `${parts.replace(/-/g, "")}_${project.replace(/\s+/g, " ").trim().toUpperCase()}`;
}

/** Marcas que Noma deja en la descripción del proyecto (idempotencia). */
export const SETUP_MARK = {
  folder: "Noma · Carpeta:",
  channel: "Noma · Canal de Slack:",
  pending: "Noma · Canal de Slack: por definir",
  badName: "Noma · Nombre:",
} as const;
