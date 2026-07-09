import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  FileText,
  CalendarPlus,
  Video,
  Rocket,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/currency/format";
import { AREA_LABELS } from "@/types/enums";
import {
  getProject,
  getProjectLinks,
  listTeamMembers,
  getCfoRequest,
} from "@/features/projects/queries";
import { listClients, getClientContacts } from "@/features/clients/queries";
import { listBriefMeetings } from "@/features/briefs/queries";
import { ProjectDialog } from "@/features/projects/project-dialog";
import { ProjectLinks } from "@/features/projects/project-links";
import { HandoffDialog } from "@/features/projects/handoff-dialog";
import { ScheduleMeetingDialog } from "@/features/briefs/schedule-meeting-dialog";
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

  const [links, clients, team, contacts, meetings, cfo] = await Promise.all([
    getProjectLinks(id),
    listClients(),
    listTeamMembers(),
    getClientContacts(project.clientId),
    listBriefMeetings(id),
    getCfoRequest(id),
  ]);
  const asanaLink = links.find((l) => l.type === "asana") ?? null;
  const isHandedOff = project.commercialStage === "Traspasado a operación";
  const clientOptions = clients.map((c) => ({
    id: c.id,
    companyName: c.companyName,
  }));
  const contactOptions = contacts.map((c) => ({
    name: c.name,
    email: c.email,
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
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-heading text-sm font-medium">
                Reunión de brief
              </h2>
              <StatusBadge
                value={
                  meetings.length > 0 ? "Reunión agendada" : "Sin reunión agendada"
                }
                size="xs"
              />
            </div>

            {meetings.length > 0 && (
              <ul className="mb-4 space-y-2.5">
                {meetings.map((m) => (
                  <li
                    key={m.id}
                    className="border-border rounded-lg border p-3 text-sm"
                  >
                    <p className="font-medium">{m.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {m.startsAt
                        ? new Date(m.startsAt).toLocaleString("es-CL", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "Sin fecha"}
                      {" · "}
                      {m.durationMin} min
                    </p>
                    {m.meetLink && (
                      <a
                        href={m.meetLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--status-emerald)]"
                      >
                        <Video className="size-3.5" />
                        Abrir Google Meet
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <p className="text-muted-foreground mb-3 text-sm">
              {meetings.length > 0
                ? "Agenda otra reunión de levantamiento si lo necesitas."
                : "Coordina el levantamiento inicial con el cliente."}
            </p>
            <ScheduleMeetingDialog
              projectId={project.id}
              projectName={project.name}
              defaultArea={project.area}
              teamMembers={team}
              contacts={contactOptions}
              trigger={
                <Button variant="outline" className="w-full">
                  <CalendarPlus className="size-4" />
                  Agendar reunión de brief
                </Button>
              }
            />
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

          <div className="border-border bg-card rounded-xl border p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-heading text-sm font-medium">
                Traspaso a operación
              </h2>
              {isHandedOff && (
                <StatusBadge value="Traspasado a operación" size="xs" />
              )}
            </div>

            {isHandedOff || cfo ? (
              <div className="mb-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs uppercase">
                    Asana
                  </span>
                  {asanaLink ? (
                    <a
                      href={asanaLink.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--status-blue)]"
                    >
                      Abrir tarea <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      Pendiente
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs uppercase">
                    Solicitud CFO
                  </span>
                  {cfo ? (
                    <StatusBadge value={cfo.status} size="xs" />
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      Sin solicitud
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground mb-3 text-sm">
                Al cerrar la venta, crea la tarea en Asana y la solicitud CFO.
              </p>
            )}

            <HandoffDialog
              projectId={project.id}
              trigger={
                <Button
                  variant={isHandedOff ? "outline" : "default"}
                  className="w-full"
                >
                  <Rocket className="size-4" />
                  {isHandedOff ? "Actualizar traspaso" : "Traspasar a operación"}
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}
