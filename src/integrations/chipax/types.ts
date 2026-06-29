/** Tipos de datos de Chipax (visualización financiera del cliente). */

export type ChipaxInvoice = {
  folio: string;
  issuedAt: string; // fecha emisión (ISO)
  dueAt: string | null; // vencimiento
  total: number;
  balanceDue: number; // saldo por pagar
  status: string; // estado en Chipax
  pdfUrl?: string;
  xmlUrl?: string;
};

export type ChipaxClientFinance = {
  rut: string;
  legalName: string;
  totalBilled: number; // facturación histórica
  totalPending: number; // total pendiente de pago
  averagePaymentDays: number | null; // días promedio de pago
  invoices: ChipaxInvoice[];
};

/** Forma normalizada que consume la UI de Noma (portal cliente). */
export type ClientFinanceView = {
  rut: string;
  legalName: string;
  totalBilled: number;
  totalPending: number;
  averagePaymentDays: number | null;
  invoices: {
    folio: string;
    issuedAt: string;
    dueAt: string | null;
    total: number;
    balanceDue: number;
    status: string;
    pdfUrl?: string;
    xmlUrl?: string;
  }[];
};
