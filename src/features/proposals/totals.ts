import {
  PRIORITY_SURCHARGE,
  type Currency,
  type DiscountKind,
  type ServicePriority,
} from "@/types/enums";
import { toCLP } from "@/lib/currency/convert";

export const IVA_RATE = 0.19;

export type LineItem = {
  amount: number | null;
  currency: Currency | null;
  quantity?: number;
  priority?: ServicePriority;
};

export type DiscountInput = {
  kind: DiscountKind | null;
  value: number | null;
  label?: string | null;
};

export type ProposalTotals = {
  subtotalUf: number; // suma de ítems en UF (con cantidad y recargo)
  subtotalClpDirect: number; // suma de ítems ya en CLP (merch/unitarios)
  subtotalUsd: number; // suma de ítems en USD (con cantidad y recargo)
  baseNetClp: number; // neto sin recargos de prioridad
  surchargeClp: number; // recargos de prioridad
  netClp: number; // neto total en CLP, antes de descuento
  discountClp: number; // descuento aplicado, en CLP
  netAfterDiscount: number; // neto tras descuento (base del IVA)
  iva: number; // IVA 19% sobre el neto ya rebajado
  totalClp: number; // neto rebajado + IVA
  ufClp: number; // UF usada para la conversión
  usdClp: number; // dólar observado usado para la conversión
};

/**
 * Precio efectivo de una línea: precio base × cantidad × (1 + recargo de prioridad).
 * El recargo de prioridad (ver PRIORITY_SURCHARGE) es un porcentaje sobre el base.
 */
export function lineAmount(item: LineItem): number {
  if (item.amount == null) return 0;
  const qty = item.quantity ?? 1;
  const surcharge = item.priority ? PRIORITY_SURCHARGE[item.priority] : 0;
  return item.amount * qty * (1 + surcharge);
}

/**
 * Convierte el descuento a CLP según su tipo, acotado para no superar el neto.
 * `percent` es sobre el neto; `clp` es directo; `uf` se convierte con la UF del día.
 */
export function discountToClp(
  discount: DiscountInput | null | undefined,
  netClp: number,
  ufClp: number,
): number {
  if (!discount || discount.kind == null || discount.value == null) return 0;
  const value = discount.value;
  if (value <= 0) return 0;
  let clp = 0;
  if (discount.kind === "percent") clp = netClp * (value / 100);
  else if (discount.kind === "clp") clp = value;
  else if (discount.kind === "uf") clp = value * ufClp;
  return Math.min(Math.round(clp), netClp); // nunca deja el neto negativo
}

/**
 * Calcula los totales de una cotización. Los ítems en UF se convierten a CLP con
 * la UF del día; los ítems en CLP se suman directo. El descuento se resta al neto
 * y el IVA (19%) se calcula sobre el neto ya rebajado (convención SII). Todo es
 * de presentación: el par monto/moneda de cada servicio es la fuente de verdad.
 */
export function computeTotals(
  items: LineItem[],
  ufClp: number,
  discount?: DiscountInput | null,
  usdClp = 0,
): ProposalTotals {
  let subtotalUf = 0;
  let subtotalClpDirect = 0;
  let subtotalUsd = 0;
  let baseNetClp = 0;
  let surchargeClp = 0;
  for (const it of items) {
    if (it.amount == null) continue;
    const effective = lineAmount(it);
    if (it.currency === "UF") subtotalUf += effective;
    else if (it.currency === "CLP") subtotalClpDirect += effective;
    else if (it.currency === "USD") subtotalUsd += effective;
    if (it.currency) {
      const quantity = it.quantity ?? 1;
      const base = toCLP(it.amount * quantity, it.currency, { ufClp, usdClp });
      const surcharge = it.priority
        ? (PRIORITY_SURCHARGE[it.priority] ?? 0)
        : 0;
      baseNetClp += base;
      surchargeClp += base * surcharge;
    }
  }
  baseNetClp = Math.round(baseNetClp);
  surchargeClp = Math.round(surchargeClp);
  const netClp = baseNetClp + surchargeClp;
  const discountClp = discountToClp(discount, netClp, ufClp);
  const netAfterDiscount = netClp - discountClp;
  const iva = Math.round(netAfterDiscount * IVA_RATE);
  return {
    subtotalUf,
    subtotalClpDirect,
    subtotalUsd,
    baseNetClp,
    surchargeClp,
    netClp,
    discountClp,
    netAfterDiscount,
    iva,
    totalClp: netAfterDiscount + iva,
    ufClp,
    usdClp,
  };
}
