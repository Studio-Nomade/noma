/**
 * Reenvíos del equipo: un cliente le escribe directo a alguien del estudio y
 * esa persona lo reenvía a la casilla de solicitudes (o al alias del cliente).
 * Aquí se lee el bloque del mensaje reenviado (Gmail, Outlook, Apple Mail, en
 * español o inglés) para recuperar el remitente original, sus destinatarios
 * y el asunto. Módulo puro.
 */

import {
  domainOf,
  externalRecipients,
  parseAddressList,
  withAlwaysCc,
  type EmailAddress,
} from "./addresses";

export type ForwardedOriginal = {
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string | null;
  date: string | null;
};

/** Líneas que abren un mensaje reenviado o citado completo. */
/** Correo de un cliente reenviado por alguien del estudio. */
export type ForwardedRequest = {
  by: EmailAddress;
  original: ForwardedOriginal;
};

const MARKER_RE =
  /^\s*(?:-{2,}\s*(?:forwarded message|mensaje reenviado|original message|mensaje original)\s*-{2,}|begin forwarded message:?|inicio del mensaje reenviado:?|_{8,})\s*$/i;

const FORWARD_SUBJECT_RE =
  /^\s*(?:(?:re|aw|rv|res)\s*:\s*)*(?:fwd?|rv|reenv(?:iado)?|tr|wg)\s*:/i;

type HeaderKey = "from" | "to" | "cc" | "subject" | "date";

const HEADER_NAMES: Record<string, HeaderKey> = {
  from: "from",
  de: "from",
  to: "to",
  para: "to",
  a: "to",
  cc: "cc",
  subject: "subject",
  asunto: "subject",
  date: "date",
  fecha: "date",
  sent: "date",
  enviado: "date",
  "enviado el": "date",
};

// `*De:*`, `**From:**` y `De :` (Outlook en texto plano a veces marca en
// negrita con asteriscos).
const HEADER_LINE_RE = /^\s*\*{0,2}([a-záéíóú ]{1,12}?)\s*:\*{0,2}\s*(.*)$/i;

/** ¿El asunto es de un reenvío (`Fwd:`, `RV:`, `Fw:`…)? */
export function isForwardSubject(subject: string | null | undefined) {
  return FORWARD_SUBJECT_RE.test(subject ?? "");
}

function cleanAddressValue(value: string) {
  // Outlook: `Nombre <mailto:a@b.cl>` o `Nombre [mailto:a@b.cl]`.
  return value
    .replace(/<mailto:([^>]+)>/gi, "<$1>")
    .replace(/\[mailto:([^\]]+)\]/gi, "<$1>")
    .replace(/\*+/g, "")
    .trim();
}

function addresses(value: string | undefined): EmailAddress[] {
  if (!value) return [];
  return parseAddressList(cleanAddressValue(value));
}

/**
 * Primer bloque de mensaje reenviado del cuerpo (el más reciente), o null si
 * no hay uno con un remitente legible. `subject` del correo ayuda a aceptar
 * bloques sin marcador (Outlook sin la línea de guiones).
 */
export function parseForwardedMessage(
  text: string | null | undefined,
  subject?: string | null,
): ForwardedOriginal | null {
  if (!text) return null;
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const forwardSubject = isForwardSubject(subject);

  for (let i = 0; i < lines.length; i += 1) {
    const marker = MARKER_RE.test(lines[i]);
    let start = i;
    if (marker) {
      start = i + 1;
      // Gmail/Apple dejan a veces una línea en blanco tras el marcador.
      while (start < lines.length && !lines[start].trim()) start += 1;
    } else if (!forwardSubject) {
      continue;
    }

    const block = readHeaderBlock(lines, start);
    if (!block) continue;
    if (!marker && !block.subject && !block.date) continue;
    const from = addresses(block.from)[0];
    if (!from?.email) continue;
    return {
      from,
      to: addresses(block.to),
      cc: addresses(block.cc),
      subject: block.subject?.trim() || null,
      date: block.date?.trim() || null,
    };
  }
  return null;
}

/**
 * Lee `Clave: valor` desde `start` hasta la primera línea en blanco. La
 * primera clave debe ser el remitente; las líneas sin clave continúan el
 * valor anterior (listas de destinatarios largas cortadas por el cliente).
 */
function readHeaderBlock(
  lines: string[],
  start: number,
): Partial<Record<HeaderKey, string>> | null {
  const out: Partial<Record<HeaderKey, string>> = {};
  let last: HeaderKey | null = null;
  for (let j = start; j < Math.min(lines.length, start + 20); j += 1) {
    const line = lines[j];
    if (!line.trim()) break;
    const match = line.match(HEADER_LINE_RE);
    const key = match
      ? HEADER_NAMES[match[1].trim().toLowerCase().replace(/\s+/g, " ")]
      : undefined;
    if (match && key) {
      if (j === start && key !== "from") return null;
      if (out[key] === undefined) out[key] = match[2];
      last = key;
      continue;
    }
    if (j === start) return null;
    if (last) out[last] = `${out[last] ?? ""} ${line.trim()}`;
  }
  return out.from ? out : null;
}

/**
 * ¿Es un reenvío de alguien del estudio con un correo de afuera adentro? Solo
 * vale si quien reenvía está autenticado como del dominio del estudio: es
 * quien responde por el remitente original que se lee del cuerpo.
 */
export function detectInternalForward(
  email: {
    from: EmailAddress | null;
    text: string | null | undefined;
    subject: string | null | undefined;
  },
  authVerified: boolean,
  studioDomain: string,
): ForwardedRequest | null {
  const studio = studioDomain.trim().toLowerCase();
  if (!authVerified || !email.from || !studio) return null;
  if (domainOf(email.from.email) !== studio) return null;
  const original = parseForwardedMessage(email.text, email.subject);
  if (!original) return null;
  if (domainOf(original.from.email) === studio) return null;
  return { by: email.from, original };
}

/**
 * Destinatarios de un reenvío interno: se responde al remitente original con
 * copia a quienes iban en su correo, a quien lo reenvió (para que vea la
 * confirmación) y a las copias fijas del canal.
 */
export function forwardedRecipients(
  forwarded: ForwardedRequest,
  alwaysCc: readonly string[],
  ownAddresses: readonly string[],
  max: number,
) {
  const requester = forwarded.original.from;
  const exclude = [...ownAddresses, requester.email];
  const visible = externalRecipients(
    [
      ...forwarded.original.to.map((address) => address.email),
      ...forwarded.original.cc.map((address) => address.email),
      forwarded.by.email,
    ],
    exclude,
  );
  const cc = withAlwaysCc(visible, alwaysCc, exclude).slice(0, max);
  return { requester, cc, aliasVisible: true };
}
