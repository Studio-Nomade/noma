import { CHILE_REGIONS, CLIENT_STATUSES } from "@/types/enums";
import { titleCaseCompany } from "@/lib/text/company-name";

/**
 * Helpers de la carga masiva de clientes. Puros (sin DB ni red) para poder
 * usarlos igual en el preview del cliente y en la server action.
 */

export type RawRow = Record<string, string>;

/** Campos de cliente que acepta la carga masiva (orden de la plantilla). */
export const IMPORT_COLUMNS = [
  { key: "companyName", header: "nombre", required: true },
  { key: "rut", header: "rut" },
  { key: "legalName", header: "razon_social" },
  { key: "email", header: "email" },
  { key: "phone", header: "telefono" },
  { key: "industry", header: "rubro" },
  { key: "taxActivity", header: "giro" },
  { key: "taxAddress", header: "direccion" },
  { key: "comuna", header: "comuna" },
  { key: "region", header: "region" },
  { key: "website", header: "sitio_web" },
  { key: "instagram", header: "instagram" },
  { key: "linkedin", header: "linkedin" },
  { key: "billingEmail", header: "email_facturacion" },
  { key: "status", header: "estado" },
  { key: "internalNotes", header: "notas" },
] as const;

export type ImportField = (typeof IMPORT_COLUMNS)[number]["key"];

/** Quita acentos y normaliza para comparar encabezados/valores. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Encabezado del CSV → campo. Incluye alias porque los archivos reales vienen
 * de Chipax/SII con nombres distintos ("Actividad" en vez de "giro", etc.).
 */
const HEADER_ALIASES: Record<string, ImportField> = {
  nombre: "companyName",
  cliente: "companyName",
  empresa: "companyName",
  "nombre cliente": "companyName",
  rut: "rut",
  "razon social": "legalName",
  email: "email",
  correo: "email",
  "e mail": "email",
  telefono: "phone",
  fono: "phone",
  celular: "phone",
  rubro: "industry",
  giro: "taxActivity",
  actividad: "taxActivity",
  actividades: "taxActivity",
  direccion: "taxAddress",
  domicilio: "taxAddress",
  comuna: "comuna",
  region: "region",
  "sitio web": "website",
  web: "website",
  sitio: "website",
  instagram: "instagram",
  linkedin: "linkedin",
  "email facturacion": "billingEmail",
  "correo facturacion": "billingEmail",
  estado: "status",
  notas: "internalNotes",
  observaciones: "internalNotes",
};

/** Mapea los encabezados de un CSV a campos; informa cuáles se ignoran. */
export function mapHeaders(headers: string[]): {
  map: Record<string, ImportField>;
  ignored: string[];
} {
  const map: Record<string, ImportField> = {};
  const ignored: string[] = [];
  for (const h of headers) {
    const field = HEADER_ALIASES[fold(h)];
    if (field) map[h] = field;
    else if (h.trim()) ignored.push(h);
  }
  return { map, ignored };
}

/** Limpia un valor de celda: colapsa tabs/saltos y espacios repetidos. */
export function cleanCell(v?: string | null): string {
  return (v ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Valores que los export contables usan para decir "vacío" ("Sin Información",
 * "Sin Rubro", "N/A"…). Guardarlos sería peor que dejar el campo nulo: ensucian
 * la ficha y rompen los filtros.
 */
const PLACEHOLDER_RE =
  /^(sin\s+(informaci[oó]n|rubro|giro|datos?|especificar|direcci[oó]n|email|correo|tel[eé]fono)|no\s+aplica|n\/?a|ningun[oa]?|none|null|-+|\.+)$/i;

export function isPlaceholder(v: string): boolean {
  return PLACEHOLDER_RE.test(v.trim());
}

/**
 * Reconoce una región de Chile aunque venga con numeral romano o el prefijo
 * "Región" (p. ej. "XIII Metropolitana de Santiago" → "Metropolitana de
 * Santiago"). Devuelve null si el texto no es una región: eso permite detectar
 * cuándo la columna "Comuna" en realidad trae regiones, como pasa con los
 * export de Chipax.
 */
export function normalizeRegion(raw?: string | null): string | null {
  const s = cleanCell(raw);
  if (!s || /^sin\s+informaci/i.test(s)) return null;

  // Quita "Región de/del" y un numeral romano inicial ("XIII ", "V "…).
  let t = s.replace(/^regi[oó]n\s+(de\s+la\s+|de\s+|del\s+)?/i, "");
  t = t.replace(/^[IVXLC]+\s+/i, "");
  const f = fold(t);
  if (!f) return null;

  // "RM" y variantes de la Metropolitana.
  if (/^(rm|region metropolitana|metropolitana)$/.test(f)) {
    return "Metropolitana de Santiago";
  }

  for (const region of CHILE_REGIONS) {
    const fr = fold(region);
    // Coincidencia por prefijo en cualquier sentido: cubre nombres largos
    // ("Magallanes y de la Antártica Chilena" → "Magallanes").
    if (f === fr || f.startsWith(fr) || fr.startsWith(f)) return region;
  }
  return null;
}

/** RUT normalizado (sin puntos ni espacios, K mayúscula) para comparar. */
export function normalizeRut(raw?: string | null): string | null {
  const s = cleanCell(raw).replace(/[.\s]/g, "").toUpperCase();
  return s || null;
}

/**
 * RUTs comodín que usa la contabilidad para agrupar (extranjeros, boletas
 * genéricas). Se repiten entre clientes distintos, así que NO sirven como
 * clave de deduplicación.
 */
const PLACEHOLDER_RUTS = new Set(["55555555-5", "66666666-6", "11111111-1"]);

export function isRealRut(rut?: string | null): boolean {
  const n = normalizeRut(rut);
  return !!n && !PLACEHOLDER_RUTS.has(n);
}

/** Fila cruda → campos del cliente, ya normalizados. */
export function normalizeRow(
  row: RawRow,
  headerMap: Record<string, ImportField>,
): Partial<Record<ImportField, string>> {
  const out: Partial<Record<ImportField, string>> = {};
  for (const [header, field] of Object.entries(headerMap)) {
    const v = cleanCell(row[header]);
    if (v && !isPlaceholder(v)) out[field] = v;
  }

  // Los export contables vienen EN MAYÚSCULAS: se normalizan a Title Case.
  if (out.companyName) out.companyName = titleCaseCompany(out.companyName);
  if (out.legalName) out.legalName = titleCaseCompany(out.legalName);

  // La columna "Comuna" de los export contables suele traer la REGIÓN.
  // Si el valor es reconocible como región, se mueve al campo correcto.
  if (out.comuna) {
    const asRegion = normalizeRegion(out.comuna);
    if (asRegion) {
      out.region = out.region ?? asRegion;
      delete out.comuna;
    }
  }
  if (out.region) {
    out.region = normalizeRegion(out.region) ?? out.region;
  }

  // Estado: solo se acepta si coincide con la lista; si no, lo pone el default.
  if (out.status) {
    const match = CLIENT_STATUSES.find((s) => fold(s) === fold(out.status!));
    if (match) out.status = match;
    else delete out.status;
  }

  // Emails en minúscula; si no parece email, se descarta (no rompe la fila).
  for (const k of ["email", "billingEmail"] as const) {
    if (out[k]) {
      const e = out[k]!.toLowerCase();
      out[k] = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : undefined;
      if (!out[k]) delete out[k];
    }
  }

  return out;
}

/** Contenido de la plantilla CSV (encabezados + una fila de ejemplo). */
export function templateCsv(): string {
  const headers = IMPORT_COLUMNS.map((c) => c.header).join(";");
  const example = [
    "ACME SpA",
    "76.123.456-7",
    "ACME Servicios SpA",
    "contacto@acme.cl",
    "+56912345678",
    "Retail",
    "Venta al por menor",
    "Av. Providencia 1234, Of. 56",
    "Providencia",
    "Metropolitana de Santiago",
    "https://acme.cl",
    "@acme",
    "https://linkedin.com/company/acme",
    "facturacion@acme.cl",
    "Prospecto",
    "Cliente referido por…",
  ]
    .map((v) => `"${v}"`)
    .join(";");
  return `${headers}\n${example}\n`;
}
