import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarPlus,
  ExternalLink,
  FileText,
  Mail,
  Pencil,
  Rocket,
  Video,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  getProjectFinanceDetails,
  getProjectSla,
} from "@/features/projects/queries";
import { getProjectTimeline } from "@/features/projects/timeline";
import { listClients, getClientContacts } from "@/features/clients/queries";
import {
  getBriefByProject,
  listBriefMeetings,
} from "@/features/briefs/queries";
import { getProjectProposals } from "@/features/proposals/queries";
import { ProjectDialog } from "@/features/projects/project-dialog";
import { ProjectLinks } from "@/features/projects/project-links";
import { HandoffDialog } from "@/features/projects/handoff-dialog";
import { ProjectTimeline } from "@/features/projects/project-timeline";
import { ScheduleMeetingDialog } from "@/features/briefs/schedule-meeting-dialog";
import { NewProposalButton } from "@/features/proposals/new-proposal-button";
import {
  getSalesOrderBillingItemsForProject,
  getSalesOrdersForProject,
} from "@/features/finance/sales-orders/queries";
import { getBotChannelForProject } from "@/features/bot/queries";
import { AuthorizedSendersCard } from "@/features/bot/authorized-senders-card";
import { getProjectRetainer } from "@/features/retainers/queries";
import { RetainerCard } from "@/features/retainers/retainer-card";

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
  const role = roleFor(user.email);
  const isFinance = role.isFinance;
  const isLegal = role.canLegal;

  const [
    links,
    clients,
    team,
    contacts,
    meetings,
    brief,
    proposals,
    cfo,
    timeline,
    finance,
    salesOrders,
    billingItems,
    financeDetails,
    sla,
    botChannelState,
    retainerData,
  ] = await Promise.all([
    getProjectLinks(id),
    listClients(),
    listTeamMembers(),
    getClientContacts(project.clientId),
    listBriefMeetings(id),
    getBriefByProject(id),
    getProjectProposals(id),
    getCfoRequest(id),
    getProjectTimeline(id, { includeFinance: isFinance }),
    isFinance ? getProjectFinance(id) : Promise.resolve(null),
    isFinance ? getSalesOrdersForProject(id) : Promise.resolve([]),
    isFinance
      ? getSalesOrderBillingItemsForProject(id)
      : Promise.resolve([]),
    isFinance
      ? getProjectFinanceDetails(id)
      : Promise.resolve({ invoices: [], collections: [] }),
    isLegal ? getProjectSla(id) : Promise.resolve(null),
    getBotChannelForProject(id),
    getProjectRetainer(id),
  ]);
  const asanaLink = links.find((link) => link.type === "asana") ?? null;
  const isHandedOff = project.commercialStage === "Traspasado a operación";
  const clientOptions = clients.map((client) => ({
    id: client.id,
    companyName: client.companyName,
  }));
  const contactOptions = contacts.map((contact) => ({
    name: contact.name,
    email: contact.email,
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

      <Tabs defaultValue="summary">
        <TabsList
          variant="line"
          className="mb-5 w-full justify-start overflow-x-auto"
        >
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="brief">Brief</TabsTrigger>
          <TabsTrigger value="proposal">Cotización</TabsTrigger>
          {isFinance && (
            <TabsTrigger value="sales-order">Nota de Venta</TabsTrigger>
          )}
          {isLegal && <TabsTrigger value="sla">SLA</TabsTrigger>}
          {isFinance && (
            <>
              <TabsTrigger value="billing">Facturación</TabsTrigger>
              <TabsTrigger value="collection">Cobranza</TabsTrigger>
            </>
          )}
          <TabsTrigger value="operation">Operación</TabsTrigger>
          <TabsTrigger value="retainer">Retainer</TabsTrigger>
          <TabsTrigger value="activity">Actividad</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="glass space-y-5 rounded-xl p-6 lg:col-span-2">
              <h2 className="font-heading text-sm font-medium">
                Datos del proyecto
              </h2>
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
              <Field label="Próxima acción" value={project.nextAction} />
            </section>
            <aside className="space-y-6">
              {isFinance && finance && (
                <section className="glass rounded-xl p-6">
                  <h2 className="font-heading mb-4 text-sm font-medium">
                    Resumen financiero
                  </h2>
                  <FinanceSummary finance={finance} />
                  <Link
                    href={`/finanzas/cobranza?clientId=${project.clientId}&projectId=${project.id}&moment=INICIO`}
                    className={cn(buttonVariants(), "mt-5 w-full")}
                  >
                    <Mail className="size-4" /> Enviar cobranza
                  </Link>
                </section>
              )}
              <section className="glass rounded-xl p-6">
                <h2 className="font-heading mb-3 text-sm font-medium">
                  Última actividad
                </h2>
                <ProjectTimeline items={timeline.slice(0, 4)} />
              </section>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="brief">
          <section className="glass rounded-xl p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading font-medium">Brief del proyecto</h2>
                <p className="text-muted-foreground text-sm">
                  {brief
                    ? `Estado: ${brief.status}`
                    : "El levantamiento todavía no ha sido iniciado."}
                </p>
              </div>
              <Link
                href={`/briefs/${project.id}`}
                className={buttonVariants({ variant: "outline" })}
              >
                <FileText className="size-4" /> Abrir brief
              </Link>
            </div>
            <MeetingList meetings={meetings} />
            <ScheduleMeetingDialog
              projectId={project.id}
              projectName={project.name}
              defaultArea={project.area}
              teamMembers={team}
              contacts={contactOptions}
              trigger={
                <Button variant="outline" className="mt-4">
                  <CalendarPlus className="size-4" /> Agendar reunión
                </Button>
              }
            />
          </section>
        </TabsContent>

        <TabsContent value="proposal">
          <section className="glass rounded-xl p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-heading font-medium">Cotizaciones</h2>
              <NewProposalButton projectId={project.id} />
            </div>
            <ListState empty="No hay cotizaciones creadas.">
              {proposals.map((proposal) => (
                <Link
                  key={proposal.id}
                  href={`/proposals/${proposal.id}`}
                  className="border-border hover:bg-accent/40 flex items-center justify-between gap-3 border-b p-3"
                >
                  <span>
                    <span className="block font-medium">{proposal.title}</span>
                    <span className="text-muted-foreground text-xs">
                      Versión {proposal.version}
                    </span>
                  </span>
                  <StatusBadge value={proposal.status} size="xs" />
                </Link>
              ))}
            </ListState>
          </section>
        </TabsContent>

        {isFinance && (
          <TabsContent value="sales-order">
            <section className="glass rounded-xl p-6">
              <h2 className="font-heading mb-5 font-medium">
                Notas de Venta y esquema de facturación
              </h2>
              <ListState empty="La propuesta aprobada aún no tiene Nota de Venta.">
                {salesOrders.map((order) => (
                  <div key={order.id} className="border-border border-b p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Link
                        href={`/finanzas/notas-de-venta/${order.id}`}
                        className="font-medium hover:underline"
                      >
                        {order.folio}
                      </Link>
                      <StatusBadge value={order.status} size="xs" />
                    </div>
                    <div className="space-y-2">
                      {billingItems
                        .filter((row) => row.orderId === order.id)
                        .map(({ item }) => (
                          <div
                            key={item.id}
                            className="flex flex-wrap justify-between gap-2 text-sm"
                          >
                            <span className="text-muted-foreground">
                              {item.label} · {item.tentativeDate ?? "Sin fecha"}
                            </span>
                            <span>
                              {formatMoney(
                                item.calculatedAmount,
                                order.currency,
                              )}{" "}
                              · {item.status}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </ListState>
            </section>
          </TabsContent>
        )}

        {isLegal && (
          <TabsContent value="sla">
            <section className="glass rounded-xl p-6">
              <h2 className="font-heading mb-4 font-medium">SLA contractual</h2>
              {sla ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <StatusBadge value={sla.status} />
                    <p className="text-muted-foreground mt-2 text-sm">
                      {sla.signedAt
                        ? `Firmado por ${sla.signedByName ?? "representante"}`
                        : "Pendiente de firma"}
                    </p>
                  </div>
                  <Link
                    href={`/proposals/${sla.proposalId}/sla`}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Abrir SLA
                  </Link>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No hay SLA generado para este proyecto.
                </p>
              )}
            </section>
          </TabsContent>
        )}

        {isFinance && (
          <>
            <TabsContent value="billing">
              <section className="glass rounded-xl p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h2 className="font-heading font-medium">
                    Facturación y cuentas por cobrar
                  </h2>
                  <Link
                    href={`/finanzas/ingresos?projectId=${project.id}`}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Ver en Finanzas
                  </Link>
                </div>
                <ListState empty="No hay facturas asociadas.">
                  {financeDetails.invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-3"
                    >
                      <span>
                        <span className="block font-medium">
                          {invoice.folio ?? "Sin folio"}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {invoice.issuedAt ?? "Sin emisión"}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-medium">
                          {formatMoney(
                            invoice.totalAmount ?? 0,
                            invoice.currency ?? "CLP",
                          )}
                        </span>
                        <StatusBadge value={invoice.status} size="xs" />
                      </span>
                    </div>
                  ))}
                </ListState>
              </section>
            </TabsContent>
            <TabsContent value="collection">
              <section className="glass rounded-xl p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h2 className="font-heading font-medium">
                    Historial de cobranza
                  </h2>
                  <Link
                    href={`/finanzas/cobranza?clientId=${project.clientId}&projectId=${project.id}&moment=INICIO`}
                    className={buttonVariants()}
                  >
                    <Mail className="size-4" /> Enviar cobranza
                  </Link>
                </div>
                <ListState empty="No se han enviado cobranzas para este proyecto.">
                  {financeDetails.collections.map((message) => (
                    <div
                      key={message.id}
                      className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-3"
                    >
                      <span>
                        <span className="block font-medium">
                          {message.subject}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {message.toEmail} ·{" "}
                          {(message.sentAt ?? message.createdAt).toLocaleString(
                            "es-CL",
                          )}
                        </span>
                      </span>
                      <StatusBadge value={message.status} size="xs" />
                    </div>
                  ))}
                </ListState>
              </section>
            </TabsContent>
          </>
        )}

        <TabsContent value="operation">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="glass rounded-xl p-6">
              <h2 className="font-heading mb-4 font-medium">
                Enlaces de operación
              </h2>
              <ProjectLinks projectId={project.id} links={links} />
            </section>
            <section className="glass rounded-xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading font-medium">
                  Traspaso a operación
                </h2>
                {isHandedOff && (
                  <StatusBadge value="Traspasado a operación" size="xs" />
                )}
              </div>
              <p className="text-muted-foreground mb-4 text-sm">
                {asanaLink
                  ? "El proyecto ya cuenta con un espacio de trabajo asociado."
                  : "Completa el traspaso y crea los recursos operativos."}
              </p>
              {asanaLink && (
                <a
                  href={asanaLink.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-4 inline-flex items-center gap-1 text-sm font-medium"
                >
                  Abrir Asana <ExternalLink className="size-3.5" />
                </a>
              )}
              {cfo && (
                <p className="mb-4 text-sm">
                  Solicitud CFO: <StatusBadge value={cfo.status} size="xs" />
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
            </section>
            <div className="lg:col-span-2">
              <AuthorizedSendersCard
                projectId={project.id}
                channel={
                  botChannelState
                    ? {
                        id: botChannelState.channel.id,
                        status: botChannelState.channel.status,
                        senders: botChannelState.senders,
                      }
                    : null
                }
                contacts={contacts.map((contact) => ({
                  id: contact.id,
                  name: contact.name,
                  email: contact.email,
                  phone: contact.phone,
                  role: contact.role,
                }))}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="retainer">
          <RetainerCard projectId={project.id} data={retainerData} />
        </TabsContent>

        <TabsContent value="activity">
          <section className="glass rounded-xl p-6">
            <h2 className="font-heading mb-5 font-medium">
              Actividad del proyecto
            </h2>
            <ProjectTimeline items={timeline} />
          </section>
        </TabsContent>
      </Tabs>
    </>
  );
}

function FinanceSummary({
  finance,
}: {
  finance: {
    invoiced: number;
    receivable: number;
    paid: number;
    collectionCount: number;
  };
}) {
  return (
    <dl className="space-y-3 text-sm">
      {[
        ["Facturado", formatMoney(finance.invoiced, "CLP")],
        ["Por cobrar", formatMoney(finance.receivable, "CLP")],
        ["Pagado", formatMoney(finance.paid, "CLP")],
        ["Cobranzas enviadas", String(finance.collectionCount)],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MeetingList({
  meetings,
}: {
  meetings: Awaited<ReturnType<typeof listBriefMeetings>>;
}) {
  if (!meetings.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No hay reuniones de brief agendadas.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {meetings.map((meeting) => (
        <div key={meeting.id} className="border-border rounded-lg border p-3">
          <p className="font-medium">{meeting.title}</p>
          <p className="text-muted-foreground text-xs">
            {meeting.startsAt
              ? new Date(meeting.startsAt).toLocaleString("es-CL")
              : "Sin fecha"}
          </p>
          {meeting.meetLink && (
            <a
              href={meeting.meetLink}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium"
            >
              <Video className="size-3.5" /> Abrir Meet
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function ListState({
  children,
  empty,
}: {
  children: React.ReactNode;
  empty: string;
}) {
  const items = Array.isArray(children) ? children : [children];
  if (!items.some(Boolean)) {
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  }
  return <div className="overflow-hidden rounded-lg">{children}</div>;
}
