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
const OUTLOOK_FIELD =
  /^\s*\*?(Enviado(?: el)?|Sent|Fecha|Date|Para|To|Asunto|Subject|CC)\s*:/i;
const SIGNATURE = /^\s*--\s*$/;

function isAttributionAt(lines: string[], index: number): boolean {
  if (!ATTRIBUTION_START.test(lines[index])) return false;
  // Gmail parte la atribución larga en varias líneas: buscar el cierre en ≤3.
  for (
    let offset = 0;
    offset < 3 && index + offset < lines.length;
    offset += 1
  ) {
    if (ATTRIBUTION_END.test(lines[index + offset])) return true;
  }
  return false;
}

function isOutlookHeaderAt(lines: string[], index: number): boolean {
  if (!OUTLOOK_FROM.test(lines[index])) return false;
  for (
    let offset = 1;
    offset <= 4 && index + offset < lines.length;
    offset += 1
  ) {
    if (OUTLOOK_FIELD.test(lines[index + offset])) return true;
  }
  return false;
}

export function stripQuotedReply(body: string): string {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const kept: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (
      SIGNATURE.test(line) ||
      SEPARATORS.some((pattern) => pattern.test(line)) ||
      isAttributionAt(lines, index) ||
      isOutlookHeaderAt(lines, index)
    ) {
      break;
    }
    if (/^\s*>/.test(line)) continue; // cita intercalada
    kept.push(line);
  }

  return kept
    .join("\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
