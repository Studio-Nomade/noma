/**
 * Contenido html_notes / html_text para Asana desde el canal correo.
 * Asana acepta un subconjunto de HTML dentro de <body> (strong, em, ul, li, a,
 * blockquote, hr…); los saltos de línea se respetan. Módulo puro.
 */

import { formatSpanishDate } from "./dates";
import type { EmailExtraction } from "./extract";
import { escapeHtml } from "./templates";

const PRIORITY_LABEL: Record<EmailExtraction["priority"], string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

export function priorityLabel(priority: EmailExtraction["priority"]) {
  return PRIORITY_LABEL[priority];
}

function link(url: string) {
  const safe = escapeHtml(url);
  return `<a href="${safe}">${safe}</a>`;
}

export function buildTaskHtmlNotes(input: {
  folio: string;
  extraction: EmailExtraction;
  requesterName: string | null;
  requesterEmail: string;
  ccEmails: string[];
  subject: string;
  receivedAt: Date;
  alias: string;
  attachmentNames: string[];
  scopeLabel: string;
  body: string;
}): string {
  const e = input.extraction;
  const requester = input.requesterName
    ? `${input.requesterName} <${input.requesterEmail}>`
    : input.requesterEmail;
  const lines = [
    `<strong>Folio:</strong> ${escapeHtml(input.folio)}`,
    `<strong>Solicitante:</strong> ${escapeHtml(requester)}`,
    input.ccEmails.length
      ? `<strong>CC:</strong> ${escapeHtml(input.ccEmails.join(", "))}`
      : null,
    `<strong>Recibido en:</strong> ${escapeHtml(input.alias)} · ${escapeHtml(input.receivedAt.toISOString())}`,
    `<strong>Asunto original:</strong> ${escapeHtml(input.subject)}`,
    `<strong>Fecha pedida:</strong> ${e.requested_due_date ? escapeHtml(formatSpanishDate(e.requested_due_date)) : "Por confirmar"}`,
    `<strong>Prioridad sugerida:</strong> ${priorityLabel(e.priority)}`,
    e.deliverable_type
      ? `<strong>Entregable:</strong> ${escapeHtml(e.deliverable_type)}`
      : null,
    `<strong>Alcance:</strong> ${escapeHtml(input.scopeLabel)}`,
    "",
    `<strong>Resumen</strong>`,
    escapeHtml(e.summary),
    e.details.length
      ? `\n<strong>Detalle</strong><ul>${e.details.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : null,
    e.links.length
      ? `<strong>Links</strong><ul>${e.links.map((url) => `<li>${link(url)}</li>`).join("")}</ul>`
      : null,
    input.attachmentNames.length
      ? `<strong>Adjuntos:</strong> ${escapeHtml(input.attachmentNames.join(", "))}`
      : null,
    "<hr/>",
    `<strong>Correo original</strong>`,
    `<blockquote>${escapeHtml(input.body.slice(0, 8_000))}</blockquote>`,
    "<em>Creada por Noma desde el correo. Para enviar una entrega, comenta «ENTREGA 01» + link(s).</em>",
  ];
  return `<body>${lines.filter((line) => line !== null).join("\n")}</body>`;
}

export function buildReplyStoryHtml(input: {
  fromName: string | null;
  fromEmail: string;
  receivedAt: Date;
  text: string;
  attachmentNames: string[];
}): string {
  const author = input.fromName
    ? `${input.fromName} <${input.fromEmail}>`
    : input.fromEmail;
  const body = input.text.trim() || "(sin texto nuevo; ver adjuntos o correo)";
  return [
    "<body>",
    `<strong>Respuesta del cliente por correo</strong> · ${escapeHtml(author)} · ${escapeHtml(input.receivedAt.toISOString())}\n`,
    escapeHtml(body.slice(0, 15_000)),
    input.attachmentNames.length
      ? `\n\n<em>Adjuntos subidos a la tarea:</em> ${escapeHtml(input.attachmentNames.join(", "))}`
      : "",
    "</body>",
  ].join("");
}

export function buildDeliveryAuditStoryHtml(input: {
  round: string;
  to: string[];
  cc: string[];
}): string {
  return `<body><em>Noma envió la Entrega ${escapeHtml(input.round)} al cliente por correo · Para: ${escapeHtml(input.to.join(", "))}${input.cc.length ? ` · CC: ${escapeHtml(input.cc.join(", "))}` : ""}</em></body>`;
}
