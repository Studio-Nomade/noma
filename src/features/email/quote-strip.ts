/**
 * Quita del cuerpo de una respuesta el texto citado, los encabezados de
 * reenvío/respuesta y la firma, para comentar en Asana solo lo nuevo.
 * Cubre Gmail ("El … escribió:" / "On … wrote:"), Outlook ("De: / From:" +
 * "Enviado: / Sent:"), líneas ">" y firmas "--". Módulo puro.
 */

const ATTRIBUTION_START = /^\s*(El|On|Le|Am)\s/i;
const ATTRIBUTION_END = /(escribi[óo]|wrote|a écrit|schrieb)\s*:?\s*$/i;
const SEPARATORS = [
  /^\s*-{2,}\s*(Original Message|Mensaje original|Forwarded message|Mensaje reenviado|Reply message)\s*-{2,}/i,
  /^\s*_{10,}\s*$/,
  /^\s*(Enviado desde mi|Sent from my|Obtener Outlook para|Get Outlook for)\b/i,
];
const OUTLOOK_FROM = /^\s*\*?(De|From)\s*:\*?\s+\S/i;
// Tipos de campo del bloque de Outlook: hacen falta al menos 2 distintos
// (además de De/From) para tratarlo como encabezado y no como texto del
// cliente ("De: logo antiguo / Para: logo nuevo").
const OUTLOOK_FIELDS: [string, RegExp][] = [
  ["sent", /^\s*\*?(Enviado(?: el)?|Sent|Fecha|Date)\s*:/i],
  ["to", /^\s*\*?(Para|To)\s*:/i],
  ["subject", /^\s*\*?(Asunto|Subject)\s*:/i],
  ["cc", /^\s*\*?(CC)\s*:/i],
];
const SIGNATURE = /^\s*--\s*$/;
/** Una firma tras `--` es corta; si sigue mucho texto, no era firma. */
const MAX_SIGNATURE_LINES = 8;

function isAttributionAt(lines: string[], index: number): boolean {
  if (!ATTRIBUTION_START.test(lines[index])) return false;
  // Gmail parte la atribución larga en varias líneas: buscar el cierre en ≤3.
  // Una atribución real trae fecha/hora o dirección (dígitos o "@").
  let span = "";
  for (
    let offset = 0;
    offset < 3 && index + offset < lines.length;
    offset += 1
  ) {
    span += ` ${lines[index + offset]}`;
    if (ATTRIBUTION_END.test(lines[index + offset])) {
      return /\d|@/.test(span);
    }
  }
  return false;
}

function isOutlookHeaderAt(lines: string[], index: number): boolean {
  if (!OUTLOOK_FROM.test(lines[index])) return false;
  const kinds = new Set<string>();
  for (
    let offset = 1;
    offset <= 5 && index + offset < lines.length;
    offset += 1
  ) {
    const line = lines[index + offset];
    const kind = OUTLOOK_FIELDS.find(([, pattern]) => pattern.test(line));
    if (kind) kinds.add(kind[0]);
    else if (line.trim()) break; // el bloque de Outlook es contiguo
  }
  return kinds.size >= 2;
}

function isQuoteStartAt(lines: string[], index: number): boolean {
  const line = lines[index];
  return (
    SEPARATORS.some((pattern) => pattern.test(line)) ||
    isAttributionAt(lines, index) ||
    isOutlookHeaderAt(lines, index)
  );
}

/** `--` es firma si lo que sigue hasta la cita (o el final) es corto. */
function isSignatureAt(lines: string[], index: number): boolean {
  if (!SIGNATURE.test(lines[index])) return false;
  let count = 0;
  for (let next = index + 1; next < lines.length; next += 1) {
    if (isQuoteStartAt(lines, next)) break;
    if (lines[next].trim()) count += 1;
    if (count > MAX_SIGNATURE_LINES) return false;
  }
  return true;
}

export type StrippedReply = {
  text: string;
  /** Se descartó contenido (cita, encabezados, firma) además de líneas ">". */
  omitted: boolean;
};

export function stripQuotedReplyDetailed(body: string): StrippedReply {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const kept: string[] = [];
  let omitted = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isSignatureAt(lines, index) || isQuoteStartAt(lines, index)) {
      omitted = lines.slice(index).some((rest) => rest.trim());
      break;
    }
    if (/^\s*>/.test(line)) continue; // cita intercalada
    kept.push(line);
  }

  return {
    text: kept
      .join("\n")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    omitted,
  };
}

export function stripQuotedReply(body: string): string {
  return stripQuotedReplyDetailed(body).text;
}
