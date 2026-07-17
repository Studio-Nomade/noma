/**
 * Utilidades de parseo de montos y fechas para archivos chilenos
 * (Nubox / cartolas bancarias). Funciones puras. Portado del MVP financiero.
 */

/** "$1.234.567", "1.234.567,89", "-45.008", "1234567" → número. */
export function parseChileanNumber(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return raw;
  let s = String(raw).trim();
  if (!s) return 0;

  const negative = /^\(.*\)$/.test(s) || s.includes("-");
  s = s.replace(/[()$\s]/g, "").replace(/-/g, "");

  if (s.includes(",") && s.includes(".")) {
    // formato es-CL: punto miles, coma decimal → quitar puntos, coma→punto
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    // solo coma: decimal
    s = s.replace(",", ".");
  } else {
    // solo puntos: son separadores de miles
    s = s.replace(/\./g, "");
  }

  const n = Number(s);
  if (Number.isNaN(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

/** Acepta yyyy-mm-dd, dd-mm-yyyy, dd/mm/yyyy, dd.mm.yyyy → Date (UTC) o null. */
export function parseFlexibleDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  const s = String(raw).trim();
  if (!s) return null;

  // yyyy-mm-dd
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return toUtc(+m[1], +m[2], +m[3]);

  // dd-mm-yyyy / dd/mm/yyyy / dd.mm.yyyy
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return toUtc(+m[3], +m[2], +m[1]);

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toUtc(y: number, mo: number, d: number): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

/** Normaliza un RUT: quita puntos, deja guión, mayúscula el dígito verificador. */
export function normalizeRut(raw: unknown): string {
  if (!raw) return "";
  return String(raw)
    .trim()
    .replace(/\./g, "")
    .replace(/\s/g, "")
    .toUpperCase()
    .replace(/^(\d+)-?([\dK])$/i, "$1-$2");
}
