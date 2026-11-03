/**
 * Seguimiento de cobranza a 7 días (función pura, testeable).
 *
 * Regla: si una factura de venta lleva 7 días desde su envío (P1/P2) sin pago
 * conciliado, sale un P3. Luego se repite cada 7 días, hasta un máximo de
 * seguimientos; pasado ese máximo NO se escala solo: queda marcada para que
 * Finanzas decida (la escalera legal es una decisión humana).
 *
 * Supresión (no se envía P3):
 *  - PAGADA: el documento está conciliado o pagado.
 *  - ANULADA: anulada o compensada por nota de crédito.
 *  - FACTORING: la factura fue cedida; cobra el factoring (flujo P7).
 *  - FECHA_COMPROMETIDA: el cliente comprometió una fecha que aún no vence.
 *  - COBRANZA_LEGAL: el caso está en manos de legal@.
 *  - PAUSADA: Finanzas pausó el seguimiento a mano.
 *  - RECIENTE: ya salió un correo hace menos de 7 días.
 *  - AUN_NO: todavía no se cumplen los 7 días desde el envío.
 *  - MAXIMO: se alcanzó el máximo de seguimientos automáticos.
 */

export const FOLLOWUP_INTERVAL_DAYS = 7;
export const FOLLOWUP_MAX = 3;

export type FollowupReason =
  | "ENVIAR"
  | "PAGADA"
  | "ANULADA"
  | "FACTORING"
  | "FECHA_COMPROMETIDA"
  | "COBRANZA_LEGAL"
  | "PAUSADA"
  | "RECIENTE"
  | "AUN_NO"
  | "MAXIMO";

export const FOLLOWUP_REASON_LABELS: Record<FollowupReason, string> = {
  ENVIAR: "Corresponde seguimiento (P3)",
  PAGADA: "Pagada o conciliada",
  ANULADA: "Anulada o con nota de crédito",
  FACTORING: "Cedida a factoring (cobra el factoring)",
  FECHA_COMPROMETIDA: "Cliente comprometió fecha de pago",
  COBRANZA_LEGAL: "En cobranza legal",
  PAUSADA: "Seguimiento pausado por Finanzas",
  RECIENTE: "Ya se envió un correo hace menos de 7 días",
  AUN_NO: "Aún no se cumplen 7 días desde el envío",
  MAXIMO: "Máximo de seguimientos alcanzado: revisar a mano",
};

export interface FollowupInput {
  /** Estado del documento contable (fin_documents.status). */
  status: string;
  recordStatus?: string;
  total: number;
  montoConciliado: number;
  /** Fecha de emisión YYYY-MM-DD (respaldo si no hay registro de envío). */
  fechaEmision: string;
  /** Envío de la factura al cliente (P1/P2). */
  sentAt?: Date | string | null;
  /** Último correo de cobranza enviado o en borrador para esta factura. */
  lastFollowupAt?: Date | string | null;
  followupCount?: number;
  committedPaymentDate?: string | null;
  factoringAt?: Date | string | null;
  legalAt?: Date | string | null;
  paused?: boolean;
  /** Hay una nota de crédito que anula el documento. */
  hasCreditNote?: boolean;
}

export interface FollowupDecision {
  send: boolean;
  reason: FollowupReason;
  /** Días transcurridos desde el envío (o la emisión). */
  daysSinceSent: number;
  /** Próxima fecha en que podría salir un seguimiento (YYYY-MM-DD). */
  nextDate: string | null;
}

const DAY = 86_400_000;

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d =
    v instanceof Date ? v : new Date(v.length === 10 ? `${v}T12:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function decideFollowup(
  input: FollowupInput,
  now: Date = new Date(),
  opts: { intervalDays?: number; max?: number } = {},
): FollowupDecision {
  const interval = opts.intervalDays ?? FOLLOWUP_INTERVAL_DAYS;
  const max = opts.max ?? FOLLOWUP_MAX;
  const base = toDate(input.sentAt) ?? toDate(input.fechaEmision) ?? now;
  const daysSinceSent = Math.floor((now.getTime() - base.getTime()) / DAY);
  const none = (reason: FollowupReason, next: Date | null = null) => ({
    send: false,
    reason,
    daysSinceSent,
    nextDate: next ? isoDay(next) : null,
  });

  const saldo = input.total - input.montoConciliado;
  if (
    input.status === "CONCILIADA" ||
    input.status === "PAGADA" ||
    saldo <= 0.5
  ) {
    return none("PAGADA");
  }
  if (
    input.status === "ANULADA" ||
    input.hasCreditNote ||
    (input.recordStatus && input.recordStatus !== "ACTIVO")
  ) {
    return none("ANULADA");
  }
  if (toDate(input.factoringAt)) return none("FACTORING");
  if (toDate(input.legalAt)) return none("COBRANZA_LEGAL");
  if (input.paused) return none("PAUSADA");

  const committed = toDate(input.committedPaymentDate);
  if (committed && committed.getTime() >= now.getTime() - DAY) {
    // Se respeta la fecha comprometida y un día de gracia.
    return none("FECHA_COMPROMETIDA", new Date(committed.getTime() + 2 * DAY));
  }

  if ((input.followupCount ?? 0) >= max) return none("MAXIMO");

  if (daysSinceSent < interval) {
    return none("AUN_NO", new Date(base.getTime() + interval * DAY));
  }

  const last = toDate(input.lastFollowupAt);
  if (last && now.getTime() - last.getTime() < interval * DAY) {
    return none("RECIENTE", new Date(last.getTime() + interval * DAY));
  }

  return { send: true, reason: "ENVIAR", daysSinceSent, nextDate: isoDay(now) };
}
