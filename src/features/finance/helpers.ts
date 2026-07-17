/**
 * Helpers del módulo CFO / Finanzas.
 * Los montos viven en columnas `numeric` de Postgres, que Drizzle devuelve como
 * `string`. `toNum` normaliza a número; `money` serializa de vuelta a string con
 * 2 decimales para escribir en la BD.
 */

/** Convierte un valor (string de numeric, number, Decimal…) a número seguro. */
export function toNum(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const n = Number(String(value));
  return Number.isNaN(n) ? 0 : n;
}

/** Serializa un número a string apto para una columna numeric (2 decimales). */
export function money(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(2);
}

/** Período SII (YYYY-MM) a partir de una fecha o ISO string. */
export function periodoSii(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 7);
}

/** Fecha en formato ISO corto (YYYY-MM-DD) para columnas `date`. */
export function toDateOnly(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

/** Formatea una fecha como YYYY-MM-DD para la UI (o "—"). */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
}
