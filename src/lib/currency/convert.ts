import type { Currency } from "@/types/enums";
import { formatMoney } from "./format";

/** Tasas del día en CLP. */
export interface Rates {
  ufClp: number; // valor de 1 UF en CLP
  usdClp: number; // valor de 1 USD en CLP (dólar observado)
}

/** Convierte un monto a CLP usando las tasas. */
export function toCLP(
  amount: number,
  currency: Currency,
  rates: Rates,
): number {
  switch (currency) {
    case "CLP":
      return amount;
    case "UF":
      return amount * rates.ufClp;
    case "USD":
      return amount * rates.usdClp;
  }
}

/** Convierte un monto desde CLP a la moneda destino. */
export function fromCLP(clp: number, to: Currency, rates: Rates): number {
  switch (to) {
    case "CLP":
      return clp;
    case "UF":
      return rates.ufClp ? clp / rates.ufClp : 0;
    case "USD":
      return rates.usdClp ? clp / rates.usdClp : 0;
  }
}

/** Convierte entre dos monedas cualesquiera. */
export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  rates: Rates,
): number {
  if (from === to) return amount;
  return fromCLP(toCLP(amount, from, rates), to, rates);
}

/**
 * Devuelve las equivalencias de un monto en las otras dos monedas, formateadas.
 * Útil para mostrar bajo un valor en UF: "≈ $X CLP · US$Y".
 */
export function equivalences(
  amount: number,
  currency: Currency,
  rates: Rates,
): string {
  const targets = (["UF", "CLP", "USD"] as Currency[]).filter(
    (c) => c !== currency,
  );
  return targets
    .map((c) => formatMoney(convertAmount(amount, currency, c, rates), c))
    .join(" · ");
}
