import type { Currency } from "@/types/enums";

export const IVA_RATE = 0.19;

export type LineItem = {
  amount: number | null;
  currency: Currency | null;
};

export type ProposalTotals = {
  subtotalUf: number; // suma de ítems en UF
  subtotalClpDirect: number; // suma de ítems ya en CLP (merch/unitarios)
  netClp: number; // neto total en CLP
  iva: number; // IVA 19% sobre el neto
  totalClp: number; // neto + IVA
  ufClp: number; // UF usada para la conversión
};

/**
 * Calcula los totales de una cotización. Los ítems en UF se convierten a CLP con
 * la UF del día; los ítems en CLP se suman directo. El IVA (19%) es de presentación.
 */
export function computeTotals(
  items: LineItem[],
  ufClp: number,
): ProposalTotals {
  let subtotalUf = 0;
  let subtotalClpDirect = 0;
  for (const it of items) {
    if (it.amount == null) continue;
    if (it.currency === "UF") subtotalUf += it.amount;
    else if (it.currency === "CLP") subtotalClpDirect += it.amount;
    else if (it.currency === "USD") continue; // USD no se usa en cotización
  }
  const netClp = Math.round(subtotalUf * ufClp + subtotalClpDirect);
  const iva = Math.round(netClp * IVA_RATE);
  return {
    subtotalUf,
    subtotalClpDirect,
    netClp,
    iva,
    totalClp: netClp + iva,
    ufClp,
  };
}
