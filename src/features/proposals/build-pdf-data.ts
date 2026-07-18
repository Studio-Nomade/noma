import { getLatestRates } from "@/lib/currency/rates";
import { AREA_LABELS } from "@/types/enums";
import { getProposal, getProposalServices, getProposalTeam } from "./queries";
import { computeTotals, type LineItem } from "./totals";
import { computeGantt } from "./gantt";
import type { ProposalPdfData } from "./proposal-pdf";
import { normalizeServices, normalizeTeam } from "./templates/normalize";
import type { Area } from "@/types/enums";

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
  const { proposal, clientName, projectName, projectArea, projectAreas } = row;

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
  const normalizedServices = normalizeServices(services);
  const cadenceUf = (cadence: "one-time" | "monthly" | "quarterly") =>
    normalizedServices
      .filter(
        (service) => service.cadence === cadence && service.currency === "UF",
      )
      .reduce((sum, service) => sum + service.amount, 0);

  const created = new Date(proposal.createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = created.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const code = `${String(created.getFullYear()).slice(2)}${pad(created.getMonth() + 1)}${pad(created.getDate())}`;
  const baseName = `${projectArea}_${code} | ${clientName ?? "Cliente"} - ${projectName}`;
  const totalLabel = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(totals.totalClp);
  const areas = (projectAreas?.length ? projectAreas : [projectArea]) as Area[];

  const data: ProposalPdfData = {
    templateVersion: "studio-nomade-2026",
    title: proposal.title,
    clientName: clientName ?? "—",
    projectName,
    proposalCode: `${projectArea}_N${code}`,
    year: created.getFullYear(),
    areas,
    areaLabel: AREA_LABELS[projectArea],
    date,
    version: proposal.version,
    services: normalizedServices,
    totals: {
      oneTimeUf: cadenceUf("one-time"),
      monthlyUf: cadenceUf("monthly"),
      quarterlyUf: cadenceUf("quarterly"),
      directClp: totals.subtotalClpDirect,
      netClp: totals.netClp,
      ivaClp: totals.iva,
      totalClp: totals.totalClp,
      ufClp,
    },
    gantt: computeGantt(proposal.timelineStages),
    team: normalizeTeam(team),
    sections: {
      context: proposal.context ?? undefined,
      objective: proposal.mainObjective ?? undefined,
      scope: proposal.scope ?? undefined,
      methodology: proposal.workStages ?? undefined,
      deliverables: proposal.deliverables ?? undefined,
      exclusions: proposal.exclusions ?? undefined,
      commercialConditions: proposal.commercialConditions ?? undefined,
      nextSteps: proposal.nextAction ?? undefined,
    },
  };

  return {
    data,
    filename: `${baseName}.pdf`,
    clientName: clientName ?? "Cliente",
    projectName,
    totalLabel,
  };
}
