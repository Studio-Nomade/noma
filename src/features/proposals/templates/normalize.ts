import { PRIORITY_SURCHARGE, type Currency, type Area } from "@/types/enums";
import type { ProposalServiceRow, ProposalTeamRow } from "../queries";
import type { BillingCadence, ProposalTemplateService } from "./types";
import { formatMoney } from "@/lib/currency/format";
import { lineAmount } from "../totals";
import { getTeamPhoto } from "./assets";

export function lines(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n|•/)
    .map((line) => line.replace(/^[-–—\s]+/, "").trim())
    .filter(Boolean);
}

export function normalizeCadence(unit: string | null): BillingCadence {
  const value = (unit ?? "").toLocaleLowerCase("es-CL");
  if (value.includes("mes") || value.includes("mensual")) return "monthly";
  if (value.includes("trimes")) return "quarterly";
  return "one-time";
}

export function normalizeServices(
  rows: ProposalServiceRow[],
): ProposalTemplateService[] {
  return rows.map((row) => {
    const base = Number(row.customPriceAmount ?? row.priceAmount) || 0;
    const currency = (row.customPriceCurrency ??
      row.priceCurrency ??
      "UF") as Currency;
    const quantity = row.quantity ?? 1;
    const surcharge = PRIORITY_SURCHARGE[row.priority] ?? 0;
    // Monto efectivo de la línea: base × cantidad × (1 + recargo de prioridad).
    const amount = lineAmount({ amount: base, currency, quantity, priority: row.priority });
    const cadence = normalizeCadence(row.unit);
    const cadenceSuffix =
      cadence === "monthly"
        ? " / mes"
        : cadence === "quarterly"
          ? " / trimestre"
          : "";
    // El recargo por prioridad se muestra explícito en el deck (decisión de negocio).
    const priorityNote =
      surcharge > 0 ? ` · ${row.priority} +${Math.round(surcharge * 100)}%` : "";
    const qtyNote = quantity > 1 ? ` · ×${quantity}` : "";
    return {
      id: row.id,
      area: row.area as Area,
      name: row.name,
      subarea: row.subarea,
      description: row.description,
      // Prioriza los entregables estructurados; cae al texto plano si están vacíos.
      deliverables: row.deliverableItems?.length
        ? row.deliverableItems.map((item) =>
            item.description
              ? `${item.title} — ${item.description}`
              : item.title,
          )
        : lines(row.deliverables),
      exclusions: lines(row.requirements),
      amount,
      currency,
      cadence,
      quantity,
      priority: row.priority,
      surcharge,
      valueLabel: `${formatMoney(amount, currency)}${cadenceSuffix} + IVA${qtyNote}${priorityNote}`,
    };
  });
}

export function normalizeTeam(rows: ProposalTeamRow[]) {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.roleInProject ?? row.roleTitle ?? "Equipo Studio Nomade",
    photoUrl: row.photoUrl ?? getTeamPhoto(row.name),
  }));
}
