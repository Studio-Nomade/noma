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
  // Variables del playbook P1–P8
  { key: "area", label: "Área del estudio (B&D, WD, A&A, A&D, CE)" },
  { key: "servicio", label: "Servicio facturado" },
  {
    key: "referencia_oc",
    label: "Referencia a la OC (', referenciando la OC N° …')",
  },
  {
    key: "tabla_facturas",
    label: "Detalle de facturas (folio, fechas, montos)",
  },
  { key: "total_pendiente", label: "Total pendiente de las facturas listadas" },
  {
    key: "pendientes_restantes",
    label: "Facturas que siguen pendientes tras un pago",
  },
  { key: "fecha_pago", label: "Fecha del pago recibido" },
  { key: "factoring", label: "Entidad de factoring (cesión)" },
  {
    key: "datos_transferencia",
    label: "Datos bancarios del estudio (desde configuración)",
  },
] as const;

export type CobranzaVars = Partial<Record<string, string>>;

export function fillTemplate(text: string, vars: CobranzaVars): string {
  return text.replace(/\{(\w+)\}/g, (_m, key: string) => vars[key] ?? "");
}
