import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { EditableField } from "@/features/proposals/editable-field";
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
          <div className="max-w-xl">
            <EditableField
              proposalId={id}
              field="title"
              label="Título"
              value={proposal.title}
              multiline={false}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {clientName ?? "—"} · {projectName} · {AREA_LABELS[projectArea]} · v
            {proposal.version}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge value={proposal.status} />
          <ProposalStatusSelect id={id} status={proposal.status} />
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

          <div className="border-border bg-card space-y-5 rounded-xl border p-6">
            <h2 className="font-heading text-sm font-medium">
              Contenido de la propuesta
            </h2>
            <EditableField
              proposalId={id}
              field="context"
              label="Contexto"
              value={proposal.context}
            />
            <EditableField
              proposalId={id}
              field="mainObjective"
              label="Objetivo general"
              value={proposal.mainObjective}
            />
            <EditableField
              proposalId={id}
              field="scope"
              label="Alcance"
              value={proposal.scope}
            />
            <EditableField
              proposalId={id}
              field="workStages"
              label="Etapas de trabajo"
              value={proposal.workStages}
            />
            <EditableField
              proposalId={id}
              field="deliverables"
              label="Entregables"
              value={proposal.deliverables}
            />
            <EditableField
              proposalId={id}
              field="timeline"
              label="Cronograma"
              value={proposal.timeline}
            />
            <EditableField
              proposalId={id}
              field="exclusions"
              label="Exclusiones"
              value={proposal.exclusions}
            />
            <EditableField
              proposalId={id}
              field="team"
              label="Equipo"
              value={proposal.team}
              placeholder="Ej: Anna Sanhueza · Dirección Creativa"
            />
            <EditableField
              proposalId={id}
              field="commercialConditions"
              label="Condiciones comerciales"
              value={proposal.commercialConditions}
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

          <div className="border-border bg-card rounded-xl border p-6">
            <EditableField
              proposalId={id}
              field="nextAction"
              label="Próxima acción"
              value={proposal.nextAction}
              multiline={false}
              placeholder="Ej: Enviar al cliente · seguimiento en 3 días"
            />
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
