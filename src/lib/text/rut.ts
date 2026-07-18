/**
 * Normalización de RUT chileno. Compartido por la carga de clientes y el módulo
 * de Finanzas: el RUT es la clave con la que se cruzan los documentos
 * tributarios (`fin_contacts`) con la ficha comercial (`clients`).
 */

/** RUT sin puntos ni espacios y con K mayúscula ("76.155.932-k" → "76155932-K"). */
export function normalizeRut(raw?: string | null): string | null {
  const s = (raw ?? "").replace(/\s+/g, "").replace(/\./g, "").toUpperCase();
  return s || null;
}

/**
 * RUTs comodín que usa la contabilidad para agrupar (extranjeros, boletas
 * genéricas). Los comparten clientes distintos, así que NO sirven como clave
 * de deduplicación ni de cruce.
 */
const PLACEHOLDER_RUTS = new Set([
  "55555555-5",
  "66666666-6",
  "11111111-1",
  "SIN-RUT",
]);

export function isRealRut(rut?: string | null): boolean {
  const n = normalizeRut(rut);
  return !!n && !PLACEHOLDER_RUTS.has(n);
}
