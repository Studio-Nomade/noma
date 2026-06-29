import type { Currency } from "@/types/enums";

/**
 * Formatea un monto en su moneda. Chile: CLP sin decimales, UF con 2, USD con 2.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: Currency,
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return "—";

  switch (currency) {
    case "CLP":
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0,
      }).format(n);
    case "USD":
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);
    case "UF":
      return `${new Intl.NumberFormat("es-CL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n)} UF`;
  }
}

/**
 * Formatea un rango de precios (servicios). Si solo hay uno, muestra "Desde".
 */
export function formatMoneyRange(
  min: number | string | null | undefined,
  max: number | string | null | undefined,
  currency: Currency,
): string {
  const hasMin = min !== null && min !== undefined && min !== "";
  const hasMax = max !== null && max !== undefined && max !== "";
  if (hasMin && hasMax) {
    return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
  }
  if (hasMin) return `Desde ${formatMoney(min, currency)}`;
  if (hasMax) return `Hasta ${formatMoney(max, currency)}`;
  return "—";
}
