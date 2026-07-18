import type { Currency, Area } from "@/types/enums";
import type { ProposalServiceRow, ProposalTeamRow } from "../queries";
import type { BillingCadence, ProposalTemplateService } from "./types";
import { formatMoney } from "@/lib/currency/format";
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
    const amount = Number(row.customPriceAmount ?? row.priceAmount) || 0;
    const currency = (row.customPriceCurrency ??
      row.priceCurrency ??
      "UF") as Currency;
    return {
      id: row.id,
      area: row.area as Area,
      name: row.name,
      subarea: row.subarea,
      description: row.description,
      deliverables: lines(row.deliverables),
      exclusions: lines(row.requirements),
      amount,
      currency,
      cadence: normalizeCadence(row.unit),
      valueLabel: `${formatMoney(amount, currency)}${normalizeCadence(row.unit) === "monthly" ? " / mes" : normalizeCadence(row.unit) === "quarterly" ? " / trimestre" : ""} + IVA`,
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
