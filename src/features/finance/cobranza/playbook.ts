/**
 * Playbook de cobranza P1–P8 (función pura, server + client).
 *
 * Son las plantillas base que reemplazan los correos que antes salían por
 * Chipax. Se levantaron de los correos reales de sales@ (auditoría 2026) y se
 * dejaron genéricas: no contienen montos, contactos ni datos bancarios reales.
 * Los datos de transferencia se inyectan en tiempo de envío desde la variable
 * de entorno `NOMA_COBRANZA_DATOS_TRANSFERENCIA` (ver `transferDetails`).
 *
 * Convención de asunto del estudio:
 *   {area} - {cliente} | {descripcion} - {tipo de correo} {periodo}
 */
import type { CobranzaMoment } from "@/types/enums";

export const COBRANZA_PLAYBOOK_CODES = [
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
] as const;
export type CobranzaPlaybookCode = (typeof COBRANZA_PLAYBOOK_CODES)[number];

export interface CobranzaPlaybookTemplate {
  code: CobranzaPlaybookCode;
  name: string;
  /** Cuándo se usa, en una línea. */
  when: string;
  /** Momento existente de `cobranza_messages` al que se asocia. */
  moment: CobranzaMoment;
  subject: string;
  body: string;
}

const FIRMA = `Saludos cordiales,
{remitente}
{estudio}`;

export const COBRANZA_PLAYBOOK: readonly CobranzaPlaybookTemplate[] = [
  {
    code: "P1",
    name: "P1 · Envío de factura",
    when: "Al emitir una factura en Nubox: se envía con el PDF y el XML.",
    moment: "INICIO",
    subject: "{area} - {cliente} | {servicio} - Factura de Servicios {mes}",
    body: `Hola {contacto},

Junto con saludar, adjuntamos la factura N° {folio}{referencia_oc} asociada al servicio {servicio}, por un total de {monto}.

{tabla_facturas}

Te compartimos los datos para realizar la transferencia:
{datos_transferencia}

Quedamos atentos al acuse de recibo y a cualquier duda o comentario.

${FIRMA}`,
  },
  {
    code: "P2",
    name: "P2 · Emisión de varias facturas",
    when: "Cuando un mismo envío reúne varias facturas (etapas o meses).",
    moment: "INICIO",
    subject: "{area} - {cliente} | {proyecto} - Emisión de Facturas",
    body: `Hola equipo {cliente},

Compartimos a continuación las facturas correspondientes a {servicio}:

{tabla_facturas}

Total: {total_pendiente}

Datos para la transferencia:
{datos_transferencia}

Les agradeceremos confirmarnos una vez gestionado el pago, para mantener nuestros registros al día.

${FIRMA}`,
  },
  {
    code: "P3",
    name: "P3 · Seguimiento de facturas pendientes",
    when: "A los 7 días del envío sin pago conciliado (lo decide el seguimiento automático).",
    moment: "RECORDATORIO",
    subject: "{area} - {cliente} | Facturas Pendientes de pago",
    body: `Hola {contacto},

Les escribimos desde el área de Finanzas de {estudio} para dar seguimiento al pago de las facturas pendientes:

{tabla_facturas}

Total pendiente: {total_pendiente}

Si el pago ya fue gestionado, les agradeceremos compartirnos el comprobante. Si aún está pendiente, ¿nos pueden indicar una fecha estimada de transferencia? La incorporamos a nuestra planificación financiera.

Datos para la transferencia:
{datos_transferencia}

${FIRMA}`,
  },
  {
    code: "P4",
    name: "P4 · Confirmación de pago recibido",
    when: "Cuando el abono queda conciliado en el banco.",
    moment: "RECORDATORIO",
    subject: "{area} - {cliente} | Comprobante de Pago - Factura {folio}",
    body: `Hola {contacto},

Te confirmamos el pago recibido el {fecha_pago} por la factura N° {folio}. ¡Muchas gracias!

{pendientes_restantes}

${FIRMA}`,
  },
  {
    code: "P5",
    name: "P5 · Datos de transferencia",
    when: "Cuando el cliente pide los datos bancarios.",
    moment: "RECORDATORIO",
    subject: "{area} - {cliente} | Datos de transferencia",
    body: `Hola {contacto},

Te compartimos la información bancaria para realizar la transferencia:
{datos_transferencia}

${FIRMA}`,
  },
  {
    code: "P6",
    name: "P6 · Solicitud de orden de compra",
    when: "Clientes que exigen OC antes de facturar.",
    moment: "INICIO",
    subject:
      "{area} - {cliente} | Envío presupuestos aprobados - Solicitud emisión OC",
    body: `Hola {contacto},

Te compartimos los presupuestos aprobados de {servicio} para que puedan emitir la orden de compra correspondiente.

Quedamos atentos al estado de emisión de la OC, para ordenar nuestra planificación de facturación. La factura hará referencia al número de OC en su glosa.

${FIRMA}`,
  },
  {
    code: "P7",
    name: "P7 · Estado de pagos con factoring",
    when: "Facturas cedidas: consulta semanal del pago al deudor.",
    moment: "RECORDATORIO",
    subject: "{area} - {cliente} | Estados de Pagos - Facturas",
    body: `Hola {contacto},

Te compartimos el detalle de las facturas que vencen esta semana:

{tabla_facturas}

¿Nos pueden indicar el estado de emisión de los pagos? Así informamos a nuestro factoring ({factoring}) y evitamos intereses por mora.

${FIRMA}`,
  },
  {
    code: "P8",
    name: "P8 · Aviso de cesión al factoring",
    when: "Al ceder una factura: se informa al cliente a quién pagar.",
    moment: "TERMINO",
    subject: "{area} - {cliente} | Cesión de Facturas - {factoring}",
    body: `Hola {contacto},

Les informamos que las siguientes facturas fueron cedidas a {factoring}:

{tabla_facturas}

El pago de estos documentos debe realizarse a {factoring}, según las instrucciones de la cesión adjunta.

${FIRMA}`,
  },
];

export function getPlaybookTemplate(
  code: CobranzaPlaybookCode,
): CobranzaPlaybookTemplate {
  const tpl = COBRANZA_PLAYBOOK.find((t) => t.code === code);
  if (!tpl) throw new Error(`Plantilla de cobranza desconocida: ${code}`);
  return tpl;
}

/** Lee el código P1–P8 desde el nombre de una plantilla guardada ("P3 · …"). */
export function playbookCodeFromName(
  name: string | null | undefined,
): CobranzaPlaybookCode | null {
  const m = /^\s*(P[1-8])\b/i.exec(name ?? "");
  return m ? (m[1].toUpperCase() as CobranzaPlaybookCode) : null;
}

export interface InvoiceRow {
  folio: string;
  fechaEmision: string; // YYYY-MM-DD
  fechaVencimiento?: string | null;
  total: number;
  pendiente: number;
}

const clp = (n: number) =>
  `$${Math.round(n).toLocaleString("es-CL", { maximumFractionDigits: 0 })}`;

const ddmmyyyy = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}-${m}-${y}` : iso;
};

/** Tabla de facturas en texto plano (los correos de cobranza van en texto). */
export function formatInvoiceTable(rows: InvoiceRow[]): string {
  if (rows.length === 0) return "";
  const lines = rows.map(
    (r) =>
      `• Factura N° ${r.folio} · emitida ${ddmmyyyy(r.fechaEmision)} · vence ${ddmmyyyy(r.fechaVencimiento)} · total ${clp(r.total)} · por pagar ${clp(r.pendiente)}`,
  );
  return lines.join("\n");
}

export function totalPendiente(rows: InvoiceRow[]): string {
  return clp(rows.reduce((a, r) => a + r.pendiente, 0));
}

/**
 * Datos de transferencia del estudio. Viven en la variable de entorno
 * `NOMA_COBRANZA_DATOS_TRANSFERENCIA` (texto multilínea; `\n` literal también
 * sirve) para que el repositorio público nunca tenga RUT ni número de cuenta.
 */
export function transferDetails(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.NOMA_COBRANZA_DATOS_TRANSFERENCIA?.trim();
  if (!raw) return "(datos de transferencia no configurados)";
  return raw.replace(/\\n/g, "\n");
}
