/**
 * Folio correlativo por cliente (`EQ-0142`) y asuntos de respuesta.
 * Módulo puro; el contador atómico vive en `folio-store.ts`.
 */

/** Prefijo válido: letra inicial + letras/dígitos, hasta 10 (EQ, G360, H5). */
export const FOLIO_PREFIX_RE = /^[A-Z][A-Z0-9]{0,9}$/;

const FOLIO_TAG_RE = /\[\s*([A-Z][A-Z0-9]{0,9})\s*-\s*(\d{4,})\s*\]/i;
const FOLIO_TAG_GLOBAL_RE = /\s*\[\s*[A-Z][A-Z0-9]{0,9}\s*-\s*\d{4,}\s*\]/gi;
const REPLY_PREFIX_RE =
  /^\s*((re|fw|fwd|rv|res|enc|aw|wg|tr)\s*(\[\d+\])?\s*:\s*)+/i;

export function formatFolio(prefix: string, number: number): string {
  const normalized = prefix.trim().toUpperCase();
  if (!FOLIO_PREFIX_RE.test(normalized)) {
    throw new Error(`Prefijo de folio inválido: ${prefix}`);
  }
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Número de folio inválido: ${number}`);
  }
  return `${normalized}-${String(number).padStart(4, "0")}`;
}

/** Folio presente en un asunto (`Re: Banner [EQ-0142]` → `EQ-0142`). */
export function findFolioInSubject(
  subject: string | null | undefined,
): string | null {
  const match = subject?.match(FOLIO_TAG_RE);
  if (!match) return null;
  return `${match[1].toUpperCase()}-${match[2]}`;
}

/** Asunto sin prefijos de respuesta/reenvío ni etiquetas de folio. */
export function cleanSubject(subject: string | null | undefined): string {
  let value = (subject ?? "").replace(FOLIO_TAG_GLOBAL_RE, " ");
  // Los prefijos pueden repetirse intercalados con etiquetas: "RE: [EXT] RE:".
  for (let i = 0; i < 5; i += 1) {
    const next = value.replace(REPLY_PREFIX_RE, "");
    if (next === value) break;
    value = next;
  }
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Asunto de las respuestas de Noma en el hilo: `Re: <asunto original> [EQ-0142]`.
 * Conserva el asunto original para que Gmail/Outlook mantengan el hilo y
 * agrega el folio solo una vez.
 */
export function replySubject(
  originalSubject: string | null | undefined,
  folio: string,
): string {
  const base = cleanSubject(originalSubject) || "Solicitud";
  return `Re: ${base} [${folio}]`;
}
