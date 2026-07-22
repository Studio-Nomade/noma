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
  Mail,
  ReceiptText,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/currency/format";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { AREA_LABELS } from "@/types/enums";
import {
  getProject,
  getProjectLinks,
  listTeamMembers,
  getCfoRequest,
  getProjectFinance,
} from "@/features/projects/queries";
import { getProjectTimeline } from "@/features/projects/timeline";
import { listClients, getClientContacts } from "@/features/clients/queries";
import { listBriefMeetings } from "@/features/briefs/queries";
import { ProjectDialog } from "@/features/projects/project-dialog";
import { ProjectLinks } from "@/features/projects/project-links";
import { HandoffDialog } from "@/features/projects/handoff-dialog";
import { ProjectTimeline } from "@/features/projects/project-timeline";
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
  const [row, user] = await Promise.all([getProject(id), requireUser()]);
  if (!row) notFound();
  const { project, clientName } = row;
  const isFinance = roleFor(user.email).isFinance;

  const [links, clients, team, contacts, meetings, cfo, timeline, finance] =
    await Promise.all([
      getProjectLinks(id),
      listClients(),
      listTeamMembers(),
      getClientContacts(project.clientId),
      listBriefMeetings(id),
      getCfoRequest(id),
      getProjectTimeline(id, { includeFinance: isFinance }),
      isFinance ? getProjectFinance(id) : Promise.resolve(null),
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
        <div className="space-y-6 lg:col-span-2">
          <div className="glass space-y-5 rounded-xl p-6">
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

          <section className="glass rounded-xl p-6">
            <h2 className="font-heading mb-5 text-sm font-medium">Actividad</h2>
            <ProjectTimeline items={timeline} />
          </section>
        </div>

        <div className="space-y-6">
          {isFinance && finance && (
            <div className="glass rounded-xl p-6">
              <h2 className="font-heading mb-4 text-sm font-medium">
                Resumen financiero
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Facturado</dt>
                  <dd className="font-medium">
                    {formatMoney(finance.invoiced, "CLP")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Por cobrar</dt>
                  <dd className="font-medium">
                    {formatMoney(finance.receivable, "CLP")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Pagado</dt>
                  <dd className="font-medium">
                    {formatMoney(finance.paid, "CLP")}
                  </dd>
                </div>
                <div className="border-border flex items-center justify-between gap-4 border-t pt-3">
                  <dt className="text-muted-foreground">Cobranzas enviadas</dt>
                  <dd className="font-medium">{finance.collectionCount}</dd>
                </div>
              </dl>

              <div className="mt-5 grid gap-2">
                <Link
                  href={`/finanzas/cobranza?clientId=${project.clientId}&projectId=${project.id}&moment=INICIO`}
                  className={cn(buttonVariants(), "w-full")}
                >
                  <Mail className="size-4" />
                  Enviar cobranza
                </Link>
                <Link
                  href="/finanzas/ingresos"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full",
                  )}
                >
                  <ReceiptText className="size-4" />
                  Ver facturas
                </Link>
              </div>
            </div>
          )}

          <div className="glass rounded-xl p-6">
            <h2 className="font-heading mb-4 text-sm font-medium">
              Links y recursos
            </h2>
            <ProjectLinks projectId={project.id} links={links} />
          </div>

          <div className="glass rounded-xl p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-heading text-sm font-medium">
                Reunión de brief
              </h2>
              <StatusBadge
                value={
                  meetings.length > 0
                    ? "Reunión agendada"
                    : "Sin reunión agendada"
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

          <div className="glass rounded-xl p-6">
            <h2 className="font-heading mb-3 text-sm font-medium">
              Cotización
            </h2>
            <p className="text-muted-foreground mb-3 text-sm">
              Genera una cotización con los servicios del catálogo, totales en
              UF + IVA y secciones editables.
            </p>
            <NewProposalButton projectId={project.id} />
          </div>

          <div className="glass rounded-xl p-6">
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

          <div className="glass rounded-xl p-6">
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
                  {isHandedOff
                    ? "Actualizar traspaso"
                    : "Traspasar a operación"}
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}
