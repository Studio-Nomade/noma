import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { formatMoney } from "@/lib/currency/format";
import { getLatestRates } from "@/lib/currency/rates";
import { AREA_LABELS } from "@/types/enums";
import {
  getProposal,
  getProposalServices,
  listServicesForArea,
} from "@/features/proposals/queries";
import { ServiceSelector } from "@/features/proposals/service-selector";
import { ProposalStatusSelect } from "@/features/proposals/proposal-status";
import { ProposalContentForm } from "@/features/proposals/proposal-content-form";
import { ProposalDeleteButton } from "@/features/proposals/proposal-delete-button";
import { computeTotals, type LineItem } from "@/features/proposals/totals";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getProposal(id);
  if (!row) notFound();
  const { proposal, clientName, projectName, projectArea } = row;

  const [selected, catalog, rates] = await Promise.all([
    getProposalServices(id),
    listServicesForArea(projectArea),
    getLatestRates(),
  ]);

  const ufClp = Number(rates.ufClp) || 0;
  const items: LineItem[] = selected.map((s) => ({
    amount: Number(s.customPriceAmount ?? s.priceAmount) || null,
    currency: (s.customPriceCurrency ??
      s.priceCurrency ??
      "UF") as LineItem["currency"],
  }));
  const totals = computeTotals(items, ufClp);

  return (
    <>
      <Link
        href={`/projects/${proposal.projectId}`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Volver al proyecto
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {proposal.title}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {clientName ?? "—"} · {projectName} · {AREA_LABELS[projectArea]} · v
            {proposal.version}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ProposalStatusSelect id={id} status={proposal.status} />
          <Link
            href={`/proposals/${id}/preview`}
            className="border-border hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
          >
            <Eye className="size-4" />
            Vista previa
          </Link>
          <ProposalDeleteButton id={id} redirectTo="/proposals" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Servicios + secciones */}
        <div className="space-y-6 lg:col-span-2">
          <div className="border-border bg-card rounded-xl border p-6">
            <ServiceSelector
              proposalId={id}
              selected={selected}
              catalog={catalog}
            />
          </div>

          <div className="border-border bg-card rounded-xl border p-6">
            <ProposalContentForm
              proposalId={id}
              initial={{
                title: proposal.title,
                context: proposal.context,
                mainObjective: proposal.mainObjective,
                scope: proposal.scope,
                workStages: proposal.workStages,
                deliverables: proposal.deliverables,
                timeline: proposal.timeline,
                exclusions: proposal.exclusions,
                team: proposal.team,
                commercialConditions: proposal.commercialConditions,
                nextAction: proposal.nextAction,
              }}
            />
          </div>
        </div>

        {/* Totales (sticky) */}
        <div className="space-y-6">
          <div className="border-border bg-card sticky top-6 rounded-xl border p-6">
            <h2 className="font-heading mb-4 text-sm font-medium">Inversión</h2>
            <dl className="space-y-2 text-sm">
              <Row
                label="Subtotal (UF)"
                value={`${totals.subtotalUf.toLocaleString("es-CL")} UF`}
              />
              {totals.subtotalClpDirect > 0 && (
                <Row
                  label="Ítems en CLP"
                  value={formatMoney(totals.subtotalClpDirect, "CLP")}
                />
              )}
              <Row label="Neto" value={formatMoney(totals.netClp, "CLP")} />
              <Row label="IVA 19%" value={formatMoney(totals.iva, "CLP")} />
              <div className="border-border mt-2 border-t pt-2">
                <Row
                  label="Total"
                  value={formatMoney(totals.totalClp, "CLP")}
                  strong
                />
              </div>
            </dl>
            <p className="text-muted-foreground mt-3 text-xs">
              {ufClp > 0
                ? `UF ${ufClp.toLocaleString("es-CL")} · ${rates.stale ? "tasa desactualizada" : "tasa del día"}`
                : "Sin tasa UF — corre npm run rates:sync"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "text-base font-semibold" : "font-medium"}>
        {value}
      </dd>
    </div>
  );
}
