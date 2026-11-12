/**
 * Avisos cortos de Noma al canal de Slack del equipo sobre el ciclo de una
 * solicitud: entrega enviada, cliente pide ajustes y solicitud cerrada.
 *
 * Los mensajes no repiten el contenido (los ajustes viven en la tarea): solo
 * dicen qué pasó y llevan el link a Asana. Cuando hay responsable, se le
 * etiqueta con su usuario de Slack (no el de Asana), resuelto por correo a
 * partir de NOMA_SLACK_USER_IDS. Módulo puro.
 */

export type SlackUserIds = ReadonlyMap<string, string>;

const SLACK_USER_ID_RE = /^[UW][A-Z0-9]{6,20}$/;

/**
 * Lee el mapa correo → usuario de Slack desde una variable con el formato
 * `correo=UXXXX,correo=UYYYY` (también acepta `:` y saltos de línea).
 * Ignora entradas mal formadas.
 */
export function parseSlackUserIds(
  raw: string | null | undefined,
): SlackUserIds {
  const map = new Map<string, string>();
  for (const entry of (raw ?? "").split(/[,;\n]+/)) {
    const match = entry.trim().match(/^([^\s=:]+@[^\s=:]+)\s*[=:]\s*(\S+)$/);
    if (!match) continue;
    const email = match[1]!.toLowerCase();
    const id = match[2]!.toUpperCase();
    if (SLACK_USER_ID_RE.test(id)) map.set(email, id);
  }
  return map;
}

/** Etiqueta de Slack del responsable, o su nombre en negrita si no hay ID. */
export function slackMention(
  person: { email?: string | null; name?: string | null } | null | undefined,
  ids: SlackUserIds,
): string | null {
  if (!person) return null;
  const id = person.email ? ids.get(person.email.trim().toLowerCase()) : null;
  if (id) return `<@${id}>`;
  const name = clean(person.name ?? "");
  return name ? `*${name}*` : null;
}

function clean(value: string) {
  return value
    .replace(/[<>&*_`~]/g, "")
    .trim()
    .slice(0, 120);
}

function round2(round: number) {
  return String(Math.max(0, Math.trunc(round))).padStart(2, "0");
}

function head(input: { folio?: string | null; clientName: string }) {
  const folio = input.folio ? `\`${clean(input.folio)}\` · ` : "";
  return `${folio}${clean(input.clientName)}`;
}

function link(url: string | null | undefined) {
  return url && /^https:\/\//.test(url) ? `<${url}|Abrir en Asana>` : null;
}

export type TeamEventMessage = { text: string; body: string };

/** 📦 Entrega enviada al cliente. */
export function deliverySentMessage(input: {
  folio?: string | null;
  clientName: string;
  round: number;
  asanaUrl?: string | null;
}): TeamEventMessage {
  const round = round2(input.round);
  return {
    text: `Entrega ${round} enviada${input.folio ? ` · ${clean(input.folio)}` : ""}`,
    body: [
      `📦 ${head(input)} · *Entrega ${round} enviada* al cliente.`,
      link(input.asanaUrl),
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/** 🔁 El cliente pidió ajustes: etiqueta al responsable. */
export function adjustmentsMessage(input: {
  folio?: string | null;
  clientName: string;
  round?: number | null;
  asanaUrl?: string | null;
  /** Etiqueta (`<@U…>`) o nombre del responsable; null si no hay. */
  assignee: string | null;
}): TeamEventMessage {
  const what = input.round
    ? `pidió *ajustes a la Entrega ${round2(input.round)}*`
    : "pidió *ajustes*";
  return {
    text: `Ajustes del cliente${input.folio ? ` · ${clean(input.folio)}` : ""}`,
    body: [
      `🔁 ${head(input)} · El cliente ${what}.`,
      input.assignee
        ? `${input.assignee}, quedaron en la tarea.`
        : "Quedaron en la tarea; *sin responsable*, asígnensela.",
      link(input.asanaUrl),
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/** ✅ Solicitud cerrada (aprobada por el cliente o completada por el equipo). */
export function requestClosedMessage(input: {
  folio?: string | null;
  clientName: string;
  by: "client" | "team";
  /** Nombre de quien la cerró (solo si la cierra el equipo). */
  closedBy?: string | null;
  asanaUrl?: string | null;
}): TeamEventMessage {
  const how =
    input.by === "client"
      ? "*Aprobada por el cliente* y cerrada."
      : `*Cerrada*${input.closedBy ? ` por ${clean(input.closedBy)}` : ""}.`;
  return {
    text: `Solicitud cerrada${input.folio ? ` · ${clean(input.folio)}` : ""}`,
    body: [`✅ ${head(input)} · ${how}`, link(input.asanaUrl)]
      .filter(Boolean)
      .join(" "),
  };
}
