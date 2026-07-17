/**
 * Sustitución de variables en plantillas de cobranza. Función pura (server+client).
 * Sintaxis: {clave}. Las claves ausentes se reemplazan por "".
 */

export const COBRANZA_VARIABLES = [
  { key: "cliente", label: "Razón social / empresa del cliente" },
  { key: "contacto", label: "Nombre del contacto" },
  { key: "proyecto", label: "Nombre del proyecto" },
  { key: "monto", label: "Monto de la factura (CLP)" },
  { key: "folio", label: "Folio de la factura" },
  { key: "mes", label: "Mes actual" },
  { key: "anio", label: "Año actual" },
  { key: "estudio", label: "Nombre del estudio" },
  { key: "remitente", label: "Nombre del remitente" },
] as const;

export type CobranzaVars = Partial<Record<string, string>>;

export function fillTemplate(text: string, vars: CobranzaVars): string {
  return text.replace(/\{(\w+)\}/g, (_m, key: string) => vars[key] ?? "");
}
