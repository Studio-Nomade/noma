import { IVA_RATE } from "@/features/proposals/totals";
import type { NuboxInvoiceDraft, NuboxLineItem } from "./types";

/**
 * Construye el borrador de Nubox a partir de los datos tributarios del cliente
 * y los servicios facturables (en CLP neto). NO emite: solo prepara el documento.
 */
export function buildNuboxDraft(input: {
  rut: string;
  legalName: string;
  taxActivity?: string | null;
  taxAddress?: string | null;
  glosa?: string;
  paymentTerms?: string;
  items: NuboxLineItem[];
}): NuboxInvoiceDraft {
  const net = Math.round(
    input.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
  );
  const iva = Math.round(net * IVA_RATE);
  return {
    rut: input.rut,
    legalName: input.legalName,
    taxActivity: input.taxActivity ?? undefined,
    taxAddress: input.taxAddress ?? undefined,
    glosa: input.glosa,
    paymentTerms: input.paymentTerms,
    items: input.items,
    net,
    iva,
    total: net + iva,
  };
}
