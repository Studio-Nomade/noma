/**
 * Correos del canal de solicitudes (HTML + texto, en español).
 *
 * HTML mínimo con estilos en línea y sin imágenes externas: los clientes de
 * correo no soportan las variables CSS de la app, por eso los colores van
 * explícitos aquí (neutros, sin identidad gráfica pesada). Módulo puro.
 */

import { formatSpanishDate } from "./dates";
import { formatRound } from "./delivery-command";

export type RenderedEmail = { html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 12px">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function layout(content: string, footer: string) {
  return [
    "<!doctype html>",
    '<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#ffffff">',
    '<div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a">',
    content,
    `<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #e5e5e5;font-size:12px;color:#6b6b6b">${footer}</p>`,
    "</div></body></html>",
  ].join("");
}

function greeting(name: string | null | undefined) {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Hola ${first}:` : "Hola:";
}

const SIGNATURE_TEXT = "Equipo Studio Nomade";

export function renderConfirmationEmail(input: {
  folio: string;
  title: string;
  requesterName?: string | null;
  dueDate?: string | null;
}): RenderedEmail {
  const due = input.dueDate
    ? formatSpanishDate(input.dueDate)
    : "por confirmar con el equipo";
  const text = [
    greeting(input.requesterName),
    "",
    `Recibimos tu solicitud [${input.folio}] · ${input.title}.`,
    `Fecha estimada: ${due}.`,
    "",
    "Responde a este correo para agregar comentarios, archivos o cambios: todo lo que envíes en este mismo hilo queda asociado a la solicitud.",
    "",
    SIGNATURE_TEXT,
  ].join("\n");

  const html = layout(
    [
      `<p style="margin:0 0 12px">${escapeHtml(greeting(input.requesterName))}</p>`,
      `<p style="margin:0 0 12px">Recibimos tu solicitud <strong>[${escapeHtml(input.folio)}]</strong> · ${escapeHtml(input.title)}.</p>`,
      `<p style="margin:0 0 12px">Fecha estimada: <strong>${escapeHtml(due)}</strong>.</p>`,
      '<p style="margin:0 0 12px">Responde a este correo para agregar comentarios, archivos o cambios: todo lo que envíes en este mismo hilo queda asociado a la solicitud.</p>',
      `<p style="margin:16px 0 0">${SIGNATURE_TEXT}</p>`,
    ].join(""),
    `Folio ${escapeHtml(input.folio)} · Mensaje automático de Studio Nomade.`,
  );
  return { html, text };
}

export function renderDeliveryEmail(input: {
  folio: string;
  round: number;
  title: string;
  links: string[];
  note?: string | null;
  requesterName?: string | null;
}): RenderedEmail {
  const round = formatRound(input.round);
  const text = [
    greeting(input.requesterName),
    "",
    `Te enviamos la Entrega ${round} de tu solicitud [${input.folio}] · ${input.title}.`,
    "",
    ...(input.links.length
      ? ["Links:", ...input.links.map((link) => `- ${link}`), ""]
      : []),
    ...(input.note ? ["Comentarios del equipo:", input.note, ""] : []),
    "Responde en este mismo hilo con tus observaciones o tu aprobación.",
    "",
    SIGNATURE_TEXT,
  ].join("\n");

  const linksHtml = input.links.length
    ? `<p style="margin:0 0 6px"><strong>Links</strong></p><ul style="margin:0 0 12px;padding-left:20px">${input.links
        .map(
          (link) =>
            `<li style="margin:0 0 4px"><a href="${escapeHtml(link)}" style="color:#1a1a1a">${escapeHtml(link)}</a></li>`,
        )
        .join("")}</ul>`
    : "";
  const noteHtml = input.note
    ? `<p style="margin:0 0 6px"><strong>Comentarios del equipo</strong></p>${paragraphs(input.note)}`
    : "";

  const html = layout(
    [
      `<p style="margin:0 0 12px">${escapeHtml(greeting(input.requesterName))}</p>`,
      `<p style="margin:0 0 12px">Te enviamos la <strong>Entrega ${round}</strong> de tu solicitud <strong>[${escapeHtml(input.folio)}]</strong> · ${escapeHtml(input.title)}.</p>`,
      linksHtml,
      noteHtml,
      '<p style="margin:0 0 12px">Responde en este mismo hilo con tus observaciones o tu aprobación.</p>',
      `<p style="margin:16px 0 0">${SIGNATURE_TEXT}</p>`,
    ].join(""),
    `Folio ${escapeHtml(input.folio)} · Entrega ${round} · Studio Nomade.`,
  );
  return { html, text };
}
