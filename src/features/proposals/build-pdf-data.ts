import { formatMoney } from "@/lib/currency/format";
import { getLatestRates } from "@/lib/currency/rates";
import { AREA_LABELS } from "@/types/enums";
import { AREA_THEME } from "@/lib/brand/brand";
import { getProposal, getProposalServices, getProposalTeam } from "./queries";
import { computeTotals, type LineItem } from "./totals";
import type { ProposalPdfData } from "./proposal-pdf";

export type PdfBundle = {
  data: ProposalPdfData;
  filename: string;
  clientName: string;
  projectName: string;
  totalLabel: string;
};

/** Reúne y formatea todo lo necesario para el PDF de una propuesta. */
export async function buildProposalPdfData(
  id: string,
): Promise<PdfBundle | null> {
  const row = await getProposal(id);
  if (!row) return null;
  const { proposal, clientName, projectName, projectArea } = row;

  const [services, team, rates] = await Promise.all([
    getProposalServices(id),
    getProposalTeam(id),
    getLatestRates(),
  ]);
  const ufClp = Number(rates.ufClp) || 0;
  const items: LineItem[] = services.map((sv) => ({
    amount: Number(sv.customPriceAmount ?? sv.priceAmount) || null,
    currency: (sv.customPriceCurrency ??
      sv.priceCurrency ??
      "UF") as LineItem["currency"],
  }));
  const totals = computeTotals(items, ufClp);

  const sectionDefs: [string, string | null][] = [
    ["Contexto", proposal.context],
    ["Objetivo general", proposal.mainObjective],
    ["Alcance", proposal.scope],
    ["Etapas de trabajo", proposal.workStages],
    ["Entregables", proposal.deliverables],
    ["Cronograma", proposal.timeline],
    ["Exclusiones", proposal.exclusions],
    ["Condiciones comerciales", proposal.commercialConditions],
  ];

  const created = new Date(proposal.createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = created.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const code = `${String(created.getFullYear()).slice(2)}${pad(created.getMonth() + 1)}${pad(created.getDate())}`;
  const baseName = `${projectArea}_${code} | ${clientName ?? "Cliente"} - ${projectName}`;
  const totalLabel = formatMoney(totals.totalClp, "CLP");

  const data: ProposalPdfData = {
    title: proposal.title,
    clientName: clientName ?? "—",
    projectName,
    areaLabel: AREA_LABELS[projectArea],
    accent: AREA_THEME[projectArea].accent,
    date,
    version: proposal.version,
    multiArea: new Set(services.map((sv) => sv.area)).size > 1,
    services: services.map((sv) => ({
      area: sv.area,
      name: sv.name,
      subarea: sv.subarea,
      value: formatMoney(
        sv.customPriceAmount ?? sv.priceAmount,
        sv.customPriceCurrency ?? sv.priceCurrency ?? "UF",
      ),
    })),
    totals: {
      subtotalUf: `${totals.subtotalUf.toLocaleString("es-CL")} UF`,
      net: formatMoney(totals.netClp, "CLP"),
      iva: formatMoney(totals.iva, "CLP"),
      total: totalLabel,
    },
    team: team.map((m) => ({
      name: m.name,
      role: m.roleInProject ?? m.roleTitle ?? "",
    })),
    sections: sectionDefs
      .filter(([, v]) => v && v.trim())
      .map(([label, v]) => ({ label, value: v as string })),
  };

  return {
    data,
    filename: `${baseName}.pdf`,
    clientName: clientName ?? "Cliente",
    projectName,
    totalLabel,
  };
}
