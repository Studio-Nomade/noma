import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/currency/format";
import { AREA_LABELS } from "@/types/enums";
import {
  getProject,
  getProjectLinks,
  listTeamMembers,
} from "@/features/projects/queries";
import { listClients } from "@/features/clients/queries";
import { ProjectDialog } from "@/features/projects/project-dialog";
import { ProjectLinks } from "@/features/projects/project-links";
import { NewProposalButton } from "@/features/proposals/new-proposal-button";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm whitespace-pre-wrap">{value || "—"}</p>
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getProject(id);
  if (!row) notFound();
  const { project, clientName } = row;

  const [links, clients, team] = await Promise.all([
    getProjectLinks(id),
    listClients(),
    listTeamMembers(),
  ]);
  const clientOptions = clients.map((c) => ({
    id: c.id,
    companyName: c.companyName,
  }));

  return (
    <>
      <Link
        href="/projects"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Volver a Proyectos
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            <Link
              href={`/clients/${project.clientId}`}
              className="hover:text-foreground"
            >
              {clientName}
            </Link>
            {" · "}
            {AREA_LABELS[project.area]}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge value={project.status} />
            <StatusBadge value={project.commercialStage} />
            <StatusBadge value={project.priority} />
          </div>
        </div>
        <ProjectDialog
          project={project}
          clients={clientOptions}
          teamMembers={team}
          trigger={
            <Button variant="outline">
              <Pencil className="size-4" />
              Editar
            </Button>
          }
        />
      </div>

      {project.nextAction && (
        <div className="border-border bg-accent/40 mb-6 rounded-xl border p-4">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Próxima acción
          </p>
          <p className="mt-0.5 text-sm font-medium">{project.nextAction}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="border-border bg-card space-y-5 rounded-xl border p-6 lg:col-span-2">
          <h2 className="font-heading text-sm font-medium">Detalle</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Tipo de proyecto" value={project.projectType} />
            <Field label="Responsable" value={project.responsible} />
            <Field label="Fecha inicio" value={project.startDate} />
            <Field label="Fecha entrega" value={project.deliveryDate} />
            <Field
              label="Presupuesto"
              value={
                project.budgetAmount
                  ? formatMoney(
                      project.budgetAmount,
                      project.budgetCurrency ?? "UF",
                    )
                  : null
              }
            />
          </div>
          <Field label="Objetivo principal" value={project.mainObjective} />
          <Field label="Descripción" value={project.description} />
          <Field label="Notas internas" value={project.internalNotes} />
        </div>

        <div className="space-y-6">
          <div className="border-border bg-card rounded-xl border p-6">
            <h2 className="font-heading mb-4 text-sm font-medium">
              Links y recursos
            </h2>
            <ProjectLinks projectId={project.id} links={links} />
          </div>

          <div className="border-border bg-card rounded-xl border p-6">
            <h2 className="font-heading mb-3 text-sm font-medium">
              Cotización
            </h2>
            <p className="text-muted-foreground mb-3 text-sm">
              Genera una cotización con los servicios del catálogo, totales en
              UF + IVA y secciones editables.
            </p>
            <NewProposalButton projectId={project.id} />
          </div>

          <div className="border-border bg-card rounded-xl border p-6">
            <h2 className="font-heading mb-3 text-sm font-medium">Brief</h2>
            <p className="text-muted-foreground mb-3 text-sm">
              Levantamiento estructurado del proyecto (general + preguntas del
              área).
            </p>
            <Link
              href={`/briefs/${project.id}`}
              className="border-border hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
            >
              <FileText className="size-4" />
              Abrir brief
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
