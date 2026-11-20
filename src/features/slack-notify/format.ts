/**
 * Avisos de Asana en Slack: del HTML de un comentario de Asana al mrkdwn de
 * Slack, y los mensajes de cada evento. Módulo puro (sin DB ni red).
 */

export const SLACK_EVENT_KINDS = [
  "mention",
  "reopened",
  "state_change",
  "assigned",
  "completed",
  "new_task",
] as const;
export type SlackEventKind = (typeof SLACK_EVENT_KINDS)[number];

export const DEFAULT_EVENTS: Record<SlackEventKind, boolean> = {
  mention: true,
  reopened: true,
  state_change: true,
  assigned: true,
  completed: true,
  new_task: true,
};

/** Máximo del extracto de un comentario en Slack (mensajes cortos). */
export const EXCERPT_MAX = 200;

/** Nombre del campo de Asana que avisa sus cambios (`state_change`). */
export const STATE_FIELD = "Estado";

function fold(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Tipo de aviso de una story de Asana (null si no avisa nada). */
export function storyEventKind(story: {
  resource_subtype?: string | null;
  html_text?: string | null;
  custom_field?: { name?: string | null } | null;
  new_enum_value?: { name?: string | null } | null;
  old_enum_value?: { name?: string | null } | null;
}): SlackEventKind | null {
  switch (story.resource_subtype) {
    case "comment_added":
      return mentionedUserGids(story.html_text).length ? "mention" : null;
    case "marked_incomplete":
      return "reopened";
    case "marked_complete":
      return "completed";
    case "assigned":
      return "assigned";
    case "enum_custom_field_changed":
      if (fold(story.custom_field?.name) !== fold(STATE_FIELD)) return null;
      // Sin cambio real (mismo valor) no se avisa.
      return fold(story.new_enum_value?.name) ===
        fold(story.old_enum_value?.name)
        ? null
        : "state_change";
    default:
      return null;
  }
}

/**
 * Eventos que en los proyectos del flujo de correo ya avisa ese flujo
 * (solicitud nueva, entrega, ajustes, cierre): el módulo no los repite.
 */
export const EMAIL_FLOW_EVENTS: ReadonlySet<SlackEventKind> = new Set([
  "new_task",
  "state_change",
  "completed",
]);

/** Usuarios de Asana mencionados en el html_text de un comentario. */
export function mentionedUserGids(html: string | null | undefined): string[] {
  if (!html) return [];
  const out: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/data-asana-type="user"/i.test(tag)) continue;
    const gid = /data-asana-gid="(\d+)"/i.exec(tag)?.[1];
    if (gid && !out.includes(gid)) out.push(gid);
  }
  return out;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1].toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

/** Escapa texto para mrkdwn de Slack (solo &, < y >). */
export function slackEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Mención de Slack, o el nombre en negrita si no hay usuario de Slack. */
export function slackMention(slackUserId: string | null, name: string | null) {
  if (slackUserId) return `<@${slackUserId}>`;
  return name ? `*${slackEscape(name.replace(/^@/, ""))}*` : "*alguien*";
}

// Marcadores privados (caracteres de uso privado de Unicode) para que el texto
// escapado no rompa los tokens de Slack (`<@U…>`, `<url|texto>`).
const OPEN = "";
const CLOSE = "";

/**
 * HTML de un comentario de Asana → mrkdwn de Slack: menciones reales (o
 * nombre en negrita), enlaces, negrita, cursiva, código y listas.
 */
export function asanaHtmlToMrkdwn(
  html: string,
  slackIdByAsanaGid: ReadonlyMap<string, string | null> = new Map(),
): string {
  let s = html.replace(/<\/?body>/gi, "");
  // Enlaces (menciones de usuario, tareas y URLs).
  s = s.replace(
    /<a\b([^>]*)>([\s\S]*?)<\/a>|<a\b([^>]*)\/>/gi,
    (_all, attrsA: string | undefined, inner: string | undefined, attrsB) => {
      const attrs = (attrsA ?? attrsB ?? "") as string;
      const text = decodeEntities((inner ?? "").replace(/<[^>]+>/g, "")).trim();
      const gid = /data-asana-gid="(\d+)"/i.exec(attrs)?.[1] ?? null;
      if (/data-asana-type="user"/i.test(attrs) && gid) {
        const slackId = slackIdByAsanaGid.get(gid) ?? null;
        return slackId
          ? `${OPEN}@${slackId}${CLOSE}`
          : `*${text.replace(/^@/, "") || "alguien"}*`;
      }
      const href = /href="([^"]+)"/i.exec(attrs)?.[1];
      if (href && /^https?:\/\//i.test(decodeEntities(href))) {
        const url = decodeEntities(href).replace(/[|<>]/g, "");
        return text && text !== url
          ? `${OPEN}${url}|${text.replace(/[|<>]/g, "")}${CLOSE}`
          : `${OPEN}${url}${CLOSE}`;
      }
      return text;
    },
  );
  s = s
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, (_a, _t, t: string) =>
      t.trim() ? `*${t.trim()}*` : "",
    )
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, (_a, _t, t: string) =>
      t.trim() ? `_${t.trim()}_` : "",
    )
    .replace(/<(s|strike|del)>([\s\S]*?)<\/\1>/gi, (_a, _t, t: string) =>
      t.trim() ? `~${t.trim()}~` : "",
    )
    .replace(/<code>([\s\S]*?)<\/code>/gi, (_a, t: string) => `\`${t}\``)
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "")
    .replace(/<\/(p|div|ul|ol|h\d|blockquote|pre)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = slackEscape(decodeEntities(s))
    .replace(new RegExp(OPEN, "g"), "<")
    .replace(new RegExp(CLOSE, "g"), ">");
  return s
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Recorta sin cortar un token de Slack (`<…>`) a la mitad. */
export function truncateMrkdwn(s: string, max = EXCERPT_MAX) {
  if (s.length <= max) return s;
  let cut = s.slice(0, max);
  const open = cut.lastIndexOf("<");
  if (open > cut.lastIndexOf(">")) cut = cut.slice(0, open);
  return `${cut.trimEnd()}…`;
}

/** Cita de Slack: cada línea con «>». */
export function quote(s: string) {
  return s
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

export type TaskRef = {
  name: string;
  url: string;
  /** Solicitud madre si el aviso es de una subtarea (pieza). */
  parentName?: string | null;
};

function taskTitle(task: TaskRef) {
  const name = slackEscape(task.name || "Tarea sin nombre");
  return task.parentName ? `${slackEscape(task.parentName)} › ${name}` : name;
}

function asanaLink(url: string) {
  return `<${url.replace(/[|<>]/g, "")}|Abrir en Asana>`;
}

export type SlackMessage = { text: string; mrkdwn: string };

/**
 * Comentario que menciona a una o más personas: una línea con las menciones,
 * el autor, la tarea y el link, y debajo el extracto (máx. EXCERPT_MAX).
 */
export function mentionMessage(input: {
  task: TaskRef;
  authorName: string | null;
  /** Menciones ya traducidas (`<@U…>` o `*Nombre*`). */
  mentions: string[];
  /** Cuerpo del comentario en mrkdwn (se recorta a EXCERPT_MAX). */
  body: string;
}): SlackMessage {
  const who = input.mentions.length ? `${input.mentions.join(" ")} · ` : "";
  return {
    text: `Comentario en ${input.task.name}`,
    mrkdwn: [
      `💬 ${who}*${slackEscape(input.authorName ?? "Alguien")}* comentó en *${taskTitle(input.task)}* · ${asanaLink(input.task.url)}`,
      input.body.trim() ? quote(truncateMrkdwn(input.body)) : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/** Tarea reabierta (completed: true → false), en una línea. */
export function reopenedMessage(input: {
  task: TaskRef;
  byName: string | null;
  state: string | null;
  /** Responsable ya traducido (`<@U…>` o `*Nombre*`), o null. */
  assignee: string | null;
}): SlackMessage {
  return {
    text: `Tarea reabierta: ${input.task.name}`,
    mrkdwn: [
      `🔁 Tarea reabierta · *${taskTitle(input.task)}*${input.byName ? ` por ${slackEscape(input.byName)}` : ""}`,
      input.state ? `Estado: *${slackEscape(input.state)}*` : null,
      input.assignee ?? "_sin responsable_",
      asanaLink(input.task.url),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

function dueLabel(dueOn: string | null | undefined) {
  if (!dueOn) return null;
  const [y, m, d] = dueOn.split("-");
  return y && m && d ? `Entrega: *${d}-${m}*` : null;
}

/** Cambio del campo Estado, en una línea. */
export function stateChangeMessage(input: {
  task: TaskRef;
  from: string | null;
  to: string | null;
  byName: string | null;
  assignee: string | null;
}): SlackMessage {
  const change = input.from
    ? `${slackEscape(input.from)} → *${slackEscape(input.to ?? "—")}*`
    : `*${slackEscape(input.to ?? "—")}*`;
  return {
    text: `Estado de ${input.task.name}: ${input.to ?? ""}`,
    mrkdwn: [
      `🔄 *${taskTitle(input.task)}* · Estado: ${change}`,
      input.byName ? `por ${slackEscape(input.byName)}` : null,
      input.assignee,
      asanaLink(input.task.url),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Asignación: se menciona al nuevo responsable. */
export function assignedMessage(input: {
  task: TaskRef;
  assignee: string;
  byName: string | null;
  dueOn: string | null;
}): SlackMessage {
  return {
    text: `Te asignaron ${input.task.name}`,
    mrkdwn: [
      `👤 ${input.assignee}, te asignaron *${taskTitle(input.task)}*`,
      input.byName ? `por ${slackEscape(input.byName)}` : null,
      dueLabel(input.dueOn),
      asanaLink(input.task.url),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Tarea cerrada (completada). */
export function completedMessage(input: {
  task: TaskRef;
  byName: string | null;
}): SlackMessage {
  return {
    text: `Tarea cerrada: ${input.task.name}`,
    mrkdwn: [
      `✅ Tarea cerrada · *${taskTitle(input.task)}*${input.byName ? ` por ${slackEscape(input.byName)}` : ""}`,
      asanaLink(input.task.url),
    ].join(" · "),
  };
}

/** Tarea nueva en el proyecto: abre el hilo. */
export function newTaskMessage(input: {
  task: TaskRef;
  folio: string | null;
  assignee: string | null;
  dueOn: string | null;
  priority: string | null;
}): SlackMessage {
  const name =
    input.folio && !input.task.name.includes(input.folio)
      ? `[${slackEscape(input.folio)}] ${taskTitle(input.task)}`
      : taskTitle(input.task);
  return {
    text: `Tarea nueva: ${input.task.name}`,
    mrkdwn: [
      `🆕 *${name}*`,
      `Responsable: ${input.assignee ?? "_sin responsable_"}`,
      dueLabel(input.dueOn),
      input.priority ? `Prioridad: *${slackEscape(input.priority)}*` : null,
      asanaLink(input.task.url),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/**
 * Agrupación: el mensaje que ya se publicó para la tarea en la ventana de
 * 60 s suma la línea nueva (un solo mensaje por tanda de eventos).
 */
export const GROUP_WINDOW_MS = 60_000;

export function groupedBody(previous: string, next: string) {
  return `${previous}\n${next}`.slice(0, 2900);
}

/** Eventos activos del vínculo (los que falten toman el valor por defecto). */
export function eventEnabled(
  events: Partial<Record<string, boolean>> | null | undefined,
  kind: SlackEventKind,
) {
  return events?.[kind] ?? DEFAULT_EVENTS[kind];
}

/** URL de la tarea en Asana. */
export function asanaTaskUrl(taskGid: string, projectGid?: string | null) {
  return `https://app.asana.com/0/${projectGid ?? "0"}/${taskGid}/f`;
}
