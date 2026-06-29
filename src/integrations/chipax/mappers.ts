import type { ChipaxClientFinance, ClientFinanceView } from "./types";

/** Mapea la respuesta de Chipax al modelo que consume la UI de Noma. */
export function mapChipaxFinance(src: ChipaxClientFinance): ClientFinanceView {
  return {
    rut: src.rut,
    legalName: src.legalName,
    totalBilled: src.totalBilled,
    totalPending: src.totalPending,
    averagePaymentDays: src.averagePaymentDays,
    invoices: src.invoices.map((i) => ({
      folio: i.folio,
      issuedAt: i.issuedAt,
      dueAt: i.dueAt,
      total: i.total,
      balanceDue: i.balanceDue,
      status: i.status,
      pdfUrl: i.pdfUrl,
      xmlUrl: i.xmlUrl,
    })),
  };
}
