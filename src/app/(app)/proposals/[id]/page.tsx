import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, Download, Send, FileCheck, Lock } from "lucide-react";
import { formatMoney } from "@/lib/currency/format";
import { getLatestRates } from "@/lib/currency/rates";
import { AREA_LABELS } from "@/types/enums";
import { AREA_THEME } from "@/lib/brand/brand";
import { ProposalReadonly } from "@/features/proposals/proposal-readonly";
import { requireUser } from "@/lib/auth";
import {
  getProposal,
  getProposalServices,
  getProposalTeam,
  getProposalVersions,
  getProposalNotes,
  listServicesForAreas,
  listTeamForSelect,
} from "@/features/proposals/queries";
import { getClientContacts } from "@/features/clients/queries";
import { listTemplatesForArea } from "@/features/email/queries";
import { ServiceSelector } from "@/features/proposals/service-selector";
import { TeamSelector } from "@/features/proposals/team-selector";
import { ProposalStatusSelect } from "@/features/proposals/proposal-status";
import { ProposalContentForm } from "@/features/proposals/proposal-content-form";
import { StagesEditor } from "@/features/proposals/stages-editor";
import { ProposalDeleteButton } from "@/features/proposals/proposal-delete-button";
import { ProposalVersions } from "@/features/proposals/proposal-versions";
import { ProposalNotes } from "@/features/proposals/proposal-notes";
import { SendProposalDialog } from "@/features/proposals/send-dialog";
import { Button } from "@/components/ui/button";
import { computeTotals, type LineItem } from "@/features/proposals/totals";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getProposal(id);
  if (!row) notFound();
  const { proposal, clientName, projectName, projectArea, projectAreas } = row;
  const areas = projectAreas?.length ? projectAreas : [projectArea];

  const root = proposal.rootId ?? proposal.id;
  const [
    user,
    selected,
    catalog,
    rates,
    team,
    members,
    versions,
    notes,
    contacts,
    templates,
  ] = await Promise.all([
    requireUser(),
    getProposalServices(id),
    listServicesForAreas(areas),
    getLatestRates(),
    getProposalTeam(id),
    listTeamForSelect(),
    getProposalVersions(root),
    getProposalNotes(root),
    proposal.clientId
      ? getClientContacts(proposal.clientId)
      : Promise.resolve([]),
    listTemplatesForArea(projectArea),
  ]);

  const ufClp = Number(rates.ufClp) || 0;
  const items: LineItem[] = selected.map((s) => ({
    amount: Number(s.customPriceAmount ?? s.priceAmount) || null,
    currency: (s.customPriceCurrency ??
      s.priceCurrency ??
      "UF") as LineItem["currency"],
  }));
  const totals = computeTotals(items, ufClp);

  const sendVars = {
    cliente: clientName ?? "",
    contacto: contacts[0]?.name ?? clientName ?? "",
    proyecto: projectName,
    propuesta: proposal.title,
    total: formatMoney(totals.totalClp, "CLP"),
    remitente: user.email ?? "",
  };
  // CC al equipo: por ahora vacío (los correos del equipo se cargan en Fase 6).
  const teamEmails: string[] = [];

  const locked = proposal.status === "Aprobada";
  const accent = AREA_THEME[projectArea].accent;

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
            {clientName ?? "—"} · {projectName} ·{" "}
            {areas.map((area) => AREA_LABELS[area]).join(" + ")} · v
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
          <a
            href={`/proposals/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
          >
            <Download className="size-4" />
            PDF
          </a>
          <SendProposalDialog
            proposalId={id}
            senderEmail={user.email ?? ""}
            contacts={contacts.map((c) => ({ email: c.email, name: c.name }))}
            teamEmails={teamEmails}
            templates={templates.map((t) => ({
              id: t.id,
              name: t.name,
              subject: t.subject,
              body: t.body,
            }))}
            vars={sendVars}
            trigger={
              <Button>
                <Send className="size-4" />
                Enviar
              </Button>
            }
          />
          <ProposalDeleteButton id={id} redirectTo="/proposals" />
        </div>
      </div>

      {locked && (
        <div className="border-border bg-accent/40 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <p className="flex items-center gap-2 text-sm">
            <Lock className="size-4" />
            <strong>Propuesta aprobada.</strong> El editor está bloqueado (solo
            lectura). Genera el SLA para continuar.
          </p>
          <Link
            href={`/proposals/${id}/sla`}
            className="bg-foreground text-background inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <FileCheck className="size-4" />
            Generar / ver SLA
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Servicios + secciones */}
        <div className="space-y-6 lg:col-span-2">
          {locked ? (
            <ProposalReadonly
              proposal={proposal}
              services={selected}
              team={team}
              totals={totals}
              accent={accent}
            />
          ) : (
            <>
              <div className="border-border bg-card rounded-xl border p-6">
                <ServiceSelector
                  proposalId={id}
                  selected={selected}
                  catalog={catalog}
                />
              </div>

              <div className="border-border bg-card rounded-xl border p-6">
                <TeamSelector proposalId={id} team={team} members={members} />
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
                    exclusions: proposal.exclusions,
                    commercialConditions: proposal.commercialConditions,
                    nextAction: proposal.nextAction,
                  }}
                />
              </div>

              <div className="border-border bg-card rounded-xl border p-6">
                <StagesEditor
                  proposalId={id}
                  initial={proposal.timelineStages ?? []}
                />
              </div>
            </>
          )}

          <div className="border-border bg-card rounded-xl border p-6">
            <ProposalNotes rootId={root} notes={notes} />
          </div>
        </div>

        {/* Columna derecha: Inversión (sticky) + Versiones */}
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

            <div className="border-border mt-4 border-t pt-4">
              <ProposalVersions currentId={id} versions={versions} />
            </div>
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
