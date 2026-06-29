/** Tipos de datos de Nubox (creación de documento tributario). */

export type NuboxLineItem = {
  description: string;
  quantity: number;
  unitPrice: number; // neto unitario
};

/** Borrador de factura a crear en Nubox (no se emite automáticamente). */
export type NuboxInvoiceDraft = {
  rut: string; // receptor
  legalName: string;
  taxActivity?: string; // giro
  taxAddress?: string;
  glosa?: string;
  paymentTerms?: string;
  items: NuboxLineItem[];
  net: number;
  iva: number;
  total: number;
};

/** Respuesta de Nubox al crear el documento. */
export type NuboxDocumentResponse = {
  nuboxId: string;
  folio?: string;
  status: string; // estado en Nubox
  createdAt: string;
};
