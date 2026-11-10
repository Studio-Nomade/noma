/**
 * Folio correlativo por cliente con el mes de ingreso (`G360-NOV-0042`) y
 * asuntos de respuesta. El número no se reinicia cada mes: el mes solo dice a
 * qué bolsa pertenece la solicitud. Los folios antiguos sin mes (`EQ-0142`)
 * se siguen reconociendo. Módulo puro; el contador atómico vive en `store.ts`.
 */

import { localDateParts } from "./dates";

/** Prefijo válido: letra inicial + letras/dígitos, hasta 10 (EQ, G360, H5). */
export const FOLIO_PREFIX_RE = /^[A-Z][A-Z0-9]{0,9}$/;

/** Meses en el folio: tres letras en español, sin tildes. */
export const FOLIO_MONTHS = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
] as const;
const MONTH_ALT = FOLIO_MONTHS.join("|");

const FOLIO_TAG_RE = new RegExp(
  `\\[\\s*([A-Z][A-Z0-9]{0,9})\\s*-\\s*(?:(${MONTH_ALT})\\s*-\\s*)?(\\d{4,})\\s*\\]`,
  "i",
);
const FOLIO_TAG_GLOBAL_RE = new RegExp(
  `\\s*\\[\\s*[A-Z][A-Z0-9]{0,9}\\s*-\\s*(?:(?:${MONTH_ALT})\\s*-\\s*)?\\d{4,}\\s*\\]`,
  "gi",
);
const REPLY_PREFIX_RE =
  /^\s*((re|fw|fwd|rv|res|enc|aw|wg|tr)\s*(\[\d+\])?\s*:\s*)+/i;

/** Mes del folio (`NOV`) según la fecha de ingreso en America/Santiago. */
export function folioMonth(date: Date): string {
  const { month } = localDateParts(date);
  const label = FOLIO_MONTHS.at(month - 1);
  if (!label) throw new Error(`Mes inválido para el folio: ${month}`);
  return label;
}

/**
 * `formatFolio("G360", 42, fecha)` → `G360-NOV-0042`. Sin fecha devuelve el
 * formato antiguo (`G360-0042`), que se mantiene para compatibilidad.
 */
export function formatFolio(
  prefix: string,
  number: number,
  date?: Date | null,
): string {
  const normalized = prefix.trim().toUpperCase();
  if (!FOLIO_PREFIX_RE.test(normalized)) {
    throw new Error(`Prefijo de folio inválido: ${prefix}`);
  }
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Número de folio inválido: ${number}`);
  }
  const padded = String(number).padStart(4, "0");
  return date
    ? `${normalized}-${folioMonth(date)}-${padded}`
    : `${normalized}-${padded}`;
}

/**
 * Folio presente en un asunto: `Re: Banner [G360-NOV-0042]` → `G360-NOV-0042`
 * y `Re: Banner [EQ-0142]` → `EQ-0142`.
 */
export function findFolioInSubject(
  subject: string | null | undefined,
): string | null {
  const match = subject?.match(FOLIO_TAG_RE);
  if (!match) return null;
  const month = match[2] ? `${match[2].toUpperCase()}-` : "";
  return `${match[1].toUpperCase()}-${month}${match[3]}`;
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
