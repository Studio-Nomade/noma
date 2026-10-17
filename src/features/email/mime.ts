/**
 * MIME para la casilla de solicitudes: decodificar mensajes de la Gmail API
 * (format=full) y construir respuestas RFC 2822 en el mismo hilo.
 * Módulo puro (sin red ni DB) para poder testearlo.
 */

import { randomBytes } from "node:crypto";
import { parseAddressList, type EmailAddress } from "./addresses";

// ── Tipos de la Gmail API (subset usado) ─────────────────────
export type GmailHeader = { name: string; value: string };
export type GmailMessagePart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailMessagePart[];
};
export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

export type EmailAttachmentRef = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string | null;
  /** Contenido ya incluido en el mensaje (adjuntos pequeños sin attachmentId). */
  inlineData: string | null;
  contentId: string | null;
  inline: boolean;
};

export type ParsedEmail = {
  gmailId: string;
  threadId: string;
  labelIds: string[];
  historyId: string | null;
  headers: Record<string, string[]>;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  subject: string;
  from: EmailAddress | null;
  replyTo: EmailAddress[];
  to: EmailAddress[];
  cc: EmailAddress[];
  date: Date;
  text: string;
  html: string | null;
  attachments: EmailAttachmentRef[];
};

// ── Decodificación ───────────────────────────────────────────
export function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function encodeBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeCharset(buffer: Buffer, charset: string | null): string {
  const label = (charset ?? "utf-8").trim().toLowerCase();
  try {
    return new TextDecoder(label).decode(buffer);
  } catch {
    return buffer.toString("utf8");
  }
}

/** Decodifica encoded-words RFC 2047 (`=?UTF-8?B?...?=` / `?Q?`). */
export function decodeMimeWords(value: string): string {
  return value
    .replace(/\?=\s+=\?/g, "?==?") // palabras contiguas: sin espacio entre ellas
    .replace(
      /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
      (_match, charset: string, encoding: string, text: string) => {
        const bytes =
          encoding.toUpperCase() === "B"
            ? Buffer.from(text, "base64")
            : Buffer.from(
                text
                  .replace(/_/g, " ")
                  .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex: string) =>
                    String.fromCharCode(parseInt(hex, 16)),
                  ),
                "latin1",
              );
        return decodeCharset(bytes, charset);
      },
    );
}

export function headerMap(headers: GmailHeader[] = []) {
  const map: Record<string, string[]> = {};
  for (const header of headers) {
    const key = header.name.toLowerCase();
    (map[key] ??= []).push(header.value);
  }
  return map;
}

function first(map: Record<string, string[]>, name: string) {
  return map[name.toLowerCase()]?.[0] ?? null;
}

/** Extrae los `<id@host>` de In-Reply-To / References. */
export function parseMessageIds(value: string | null | undefined): string[] {
  if (!value) return [];
  return [...value.matchAll(/<[^<>\s]+>/g)].map((match) => match[0]);
}

function charsetOf(part: GmailMessagePart) {
  const contentType = first(headerMap(part.headers), "content-type") ?? "";
  return contentType.match(/charset="?([^";\s]+)"?/i)?.[1] ?? null;
}

function isAttachment(part: GmailMessagePart) {
  if (part.filename) return true;
  const disposition =
    first(headerMap(part.headers), "content-disposition") ?? "";
  return /^\s*attachment/i.test(disposition);
}

/** Recorre el árbol MIME y separa cuerpo texto/HTML y adjuntos. */
export function collectParts(root: GmailMessagePart | undefined) {
  let text: string | null = null;
  let html: string | null = null;
  const attachments: EmailAttachmentRef[] = [];

  const walk = (part: GmailMessagePart) => {
    const mimeType = (part.mimeType ?? "").toLowerCase();
    if (part.parts?.length) {
      part.parts.forEach(walk);
      return;
    }
    if (isAttachment(part)) {
      const headers = headerMap(part.headers);
      const disposition = first(headers, "content-disposition") ?? "";
      attachments.push({
        filename: decodeMimeWords(part.filename || "adjunto"),
        mimeType: mimeType || "application/octet-stream",
        size: part.body?.size ?? 0,
        attachmentId: part.body?.attachmentId ?? null,
        inlineData: part.body?.data ?? null,
        contentId: first(headers, "content-id"),
        inline: /^\s*inline/i.test(disposition),
      });
      return;
    }
    const data = part.body?.data;
    if (!data) return;
    const decoded = decodeCharset(decodeBase64Url(data), charsetOf(part));
    if (mimeType === "text/plain" && text === null) text = decoded;
    else if (mimeType === "text/html" && html === null) html = decoded;
  };
  if (root) walk(root);
  return { text, html, attachments };
}

export function parseGmailMessage(message: GmailMessage): ParsedEmail {
  const headers = headerMap(message.payload?.headers);
  const decoded = (name: string) => {
    const value = first(headers, name);
    return value === null ? null : decodeMimeWords(value);
  };
  const { text, html, attachments } = collectParts(message.payload);
  const dateHeader = first(headers, "date");
  const parsedDate = dateHeader ? new Date(dateHeader) : null;
  const internal = message.internalDate
    ? new Date(Number(message.internalDate))
    : null;
  const date =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate
      : internal && !Number.isNaN(internal.getTime())
        ? internal
        : new Date();

  const decodedHeaders: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(headers)) {
    decodedHeaders[key] = values.map(decodeMimeWords);
  }

  return {
    gmailId: message.id,
    threadId: message.threadId,
    labelIds: message.labelIds ?? [],
    historyId: message.historyId ?? null,
    headers: decodedHeaders,
    messageId: parseMessageIds(first(headers, "message-id"))[0] ?? null,
    inReplyTo: parseMessageIds(first(headers, "in-reply-to"))[0] ?? null,
    references: parseMessageIds(first(headers, "references")),
    subject: decoded("subject") ?? "",
    from: parseAddressList(decoded("from"))[0] ?? null,
    replyTo: parseAddressList(decoded("reply-to")),
    to: (decodedHeaders.to ?? []).flatMap((value) => parseAddressList(value)),
    cc: (decodedHeaders.cc ?? []).flatMap((value) => parseAddressList(value)),
    date,
    text: text ?? (html ? htmlToText(html) : ""),
    html,
    attachments,
  };
}

// ── HTML → texto ─────────────────────────────────────────────
const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
  uuml: "ü",
  iexcl: "¡",
  iquest: "¿",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity[0] === "#") {
        const code =
          entity[1].toLowerCase() === "x"
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[entity] ?? match;
    },
  );
}

/**
 * Corta el HTML donde empieza la cita de una respuesta (Gmail `gmail_quote`,
 * Outlook `divRplyFwdMsg`/`appendonsend`, Apple/Thunderbird `blockquote cite`).
 * Las citas siempre quedan al final en respuestas "top-posting".
 */
export function stripHtmlQuote(html: string): string {
  const markers = [
    /<div[^>]+class="[^"]*gmail_quote/i,
    /<div[^>]+id="?divRplyFwdMsg/i,
    /<div[^>]+id="?appendonsend/i,
    /<hr[^>]+id="?stopSpelling/i,
    /<blockquote[^>]+type="?cite/i,
  ];
  let cut = html.length;
  for (const marker of markers) {
    const index = html.search(marker);
    if (index !== -1 && index < cut) cut = index;
  }
  return html.slice(0, cut);
}

export function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<\/(p|div|h[1-6]|tr|li|ul|ol|blockquote)>/gi, "\n")
      .replace(
        /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
        (_m, href, label) =>
          String(label)
            .replace(/<[^>]+>/g, "")
            .trim() === href
            ? href
            : `${label} (${href})`,
      )
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\u00a0]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Construcción de respuestas RFC 2822 ──────────────────────
export type OutgoingEmail = {
  from: EmailAddress;
  to: string[];
  cc?: string[];
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  inReplyTo?: string | null;
  references?: string[];
  messageId?: string | null;
  date?: Date;
};

const ASCII_PRINTABLE = /^[\x20-\x7e]*$/;

/** Encoded-word UTF-8 (B), partido en trozos ≤ 75 caracteres (RFC 2047). */
export function encodeHeaderValue(value: string): string {
  if (ASCII_PRINTABLE.test(value)) return value;
  const words: string[] = [];
  let chunk = "";
  for (const char of value) {
    const candidate = chunk + char;
    // 45 bytes → 60 caracteres base64 + 12 de envoltorio = 72 ≤ 75.
    if (Buffer.byteLength(candidate, "utf8") > 45) {
      words.push(chunk);
      chunk = char;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) words.push(chunk);
  return words
    .map(
      (word) => `=?UTF-8?B?${Buffer.from(word, "utf8").toString("base64")}?=`,
    )
    .join("\r\n ");
}

export function formatAddress(address: EmailAddress): string {
  if (!address.name) return address.email;
  const name = ASCII_PRINTABLE.test(address.name)
    ? `"${address.name.replace(/["\\]/g, "")}"`
    : encodeHeaderValue(address.name);
  return `${name} <${address.email}>`;
}

/**
 * In-Reply-To / References de una respuesta: References = cadena previa +
 * mensaje al que se responde, sin duplicados. Se conserva el primero (raíz del
 * hilo) y los últimos para no exceder un largo razonable.
 */
export function buildReplyThreadHeaders(input: {
  parentMessageId: string | null;
  references?: (string | null | undefined)[];
}): { inReplyTo: string | null; references: string[] } {
  const chain: string[] = [];
  for (const id of [...(input.references ?? []), input.parentMessageId]) {
    for (const parsed of parseMessageIds(id ?? "")) {
      if (!chain.includes(parsed)) chain.push(parsed);
    }
  }
  const references =
    chain.length > 20 ? [chain[0], ...chain.slice(-19)] : chain;
  const parent = parseMessageIds(input.parentMessageId ?? "")[0] ?? null;
  return { inReplyTo: parent, references };
}

function wrapBase64(value: string) {
  return (value.match(/.{1,76}/g) ?? [""]).join("\r\n");
}

export function generateMessageId(domain: string): string {
  return `<noma.${Date.now().toString(36)}.${randomBytes(8).toString("hex")}@${domain}>`;
}

/** Mensaje multipart/alternative (texto + HTML) listo para `messages.send`. */
export function buildMimeMessage(
  email: OutgoingEmail,
  boundary = `noma_${randomBytes(12).toString("hex")}`,
): string {
  const headers = [
    `From: ${formatAddress(email.from)}`,
    `To: ${email.to.join(", ")}`,
    email.cc?.length ? `Cc: ${email.cc.join(", ")}` : null,
    email.replyTo ? `Reply-To: ${email.replyTo}` : null,
    `Subject: ${encodeHeaderValue(email.subject)}`,
    `Date: ${(email.date ?? new Date()).toUTCString().replace("GMT", "+0000")}`,
    email.messageId ? `Message-ID: ${email.messageId}` : null,
    email.inReplyTo ? `In-Reply-To: ${email.inReplyTo}` : null,
    email.references?.length
      ? `References: ${email.references.join("\r\n ")}`
      : null,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter((line): line is string => line !== null);

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(email.text, "utf8").toString("base64")),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(email.html, "utf8").toString("base64")),
    `--${boundary}--`,
    "",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${body.join("\r\n")}`;
}
