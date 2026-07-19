import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  briefMeetings,
  briefs,
  cfoRequests,
  cobranzaMessages,
  invoices,
  projects,
  proposals,
} from "@/db/schema";
import { formatMoney } from "@/lib/currency/format";
import { COBRANZA_MOMENT_LABELS } from "@/types/enums";

export type ProjectTimelineItem =
  | TimelineItem<"lead">
  | TimelineItem<"brief">
  | TimelineItem<"proposal">
  | TimelineItem<"handoff">
  | TimelineItem<"invoice">
  | TimelineItem<"collection">
  | TimelineItem<"payment">
  | TimelineItem<"activity">;

type TimelineItem<Kind extends string> = {
  id: string;
  kind: Kind;
  date: Date | string;
  title: string;
  meta?: string;
  href?: string;
  badge?: string;
};

function activityTitle(entityType: string, action: string): string {
  if (action.startsWith("stage_changed:")) return "Etapa comercial actualizada";
  if (action.startsWith("brief_approved:")) return "Brief aprobado";
  if (action.startsWith("notes_processed:"))
    return "Notas del brief procesadas";

  const titles: Record<string, string> = {
    brief_edited: "Brief actualizado",
    notes_imported: "Notas incorporadas al brief",
    notes_associated: "Notas asociadas al brief",
    notes_matched_auto: "Notas vinculadas automáticamente",
    handoff_asana_created: "Traspaso creado en Asana",
    handoff_registered: "Traspaso registrado",
    proposal_created_from_brief: "Propuesta creada desde el brief",
    meeting_scheduled: "Reunión de brief agendada",
  };
  return (
    titles[action] ??
    `${entityType.replaceAll("_", " ")} · ${action.replaceAll("_", " ")}`
  );
}

function activityKind(entityType: string, action: string) {
  if (action.startsWith("stage_changed:")) return "lead" as const;
  if (entityType === "brief" || entityType === "brief_meeting") {
    return "brief" as const;
  }
  if (entityType === "proposal") return "proposal" as const;
  if (action.startsWith("handoff_")) return "handoff" as const;
  if (entityType === "invoice") return "invoice" as const;
  if (entityType === "cobranza_message") return "collection" as const;
  return "activity" as const;
}

function activityHref(entityType: string, entityId: string, projectId: string) {
  if (entityType === "proposal") return `/proposals/${entityId}`;
  if (entityType === "brief" || entityType === "brief_meeting") {
    return `/briefs/${projectId}`;
  }
  return `/projects/${projectId}`;
}

/**
 * Ciclo de vida 360° de una oportunidad. Los hitos estructurados son la fuente
 * principal; activity_log complementa cambios que no tienen tabla propia.
 */
export async function getProjectTimeline(
  projectId: string,
  { includeFinance }: { includeFinance: boolean },
): Promise<ProjectTimelineItem[]> {
  const [
    projectRows,
    meetings,
    briefRows,
    proposalRows,
    cfoRows,
    invoiceRows,
    messages,
  ] = await Promise.all([
    db
      .select({ id: projects.id, createdAt: projects.createdAt })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1),
    db
      .select()
      .from(briefMeetings)
      .where(eq(briefMeetings.projectId, projectId)),
    db
      .select({ id: briefs.id })
      .from(briefs)
      .where(eq(briefs.projectId, projectId)),
    db.select().from(proposals).where(eq(proposals.projectId, projectId)),
    db.select().from(cfoRequests).where(eq(cfoRequests.projectId, projectId)),
    db.select().from(invoices).where(eq(invoices.projectId, projectId)),
    db
      .select()
      .from(cobranzaMessages)
      .where(eq(cobranzaMessages.projectId, projectId)),
  ]);

  const project = projectRows[0];
  if (!project) return [];

  const relatedIds = [
    project.id,
    ...meetings.map((row) => row.id),
    ...briefRows.map((row) => row.id),
    ...proposalRows.map((row) => row.id),
    ...cfoRows.map((row) => row.id),
    ...invoiceRows.map((row) => row.id),
    ...messages.map((row) => row.id),
  ];

  // Una sola consulta para toda la trazabilidad complementaria relacionada.
  const activities = await db
    .select()
    .from(activityLog)
    .where(inArray(activityLog.entityId, [...new Set(relatedIds)]))
    .orderBy(desc(activityLog.createdAt));

  const items: ProjectTimelineItem[] = [
    {
      id: `project-created-${project.id}`,
      kind: "lead",
      date: project.createdAt,
      title: "Oportunidad creada",
      href: `/projects/${projectId}`,
      badge: "Nuevo lead",
    },
  ];

  for (const meeting of meetings) {
    items.push({
      id: `meeting-${meeting.id}`,
      kind: "brief",
      date: meeting.startsAt ?? meeting.createdAt,
      title: meeting.title,
      meta:
        meeting.objective ??
        `Reunión de brief · ${meeting.durationMin} minutos`,
      href: `/briefs/${projectId}`,
      badge: meeting.status,
    });
  }

  for (const proposal of proposalRows) {
    items.push({
      id: `proposal-${proposal.id}`,
      kind: "proposal",
      date: proposal.createdAt,
      title: proposal.title,
      meta: `Propuesta v${proposal.version}`,
      href: `/proposals/${proposal.id}`,
      badge: proposal.status,
    });
  }

  for (const request of cfoRows) {
    items.push({
      id: `handoff-${request.id}`,
      kind: "handoff",
      date: request.createdAt,
      title: "Traspaso a operación y Finanzas",
      meta: request.notes ?? request.requestedByEmail ?? undefined,
      href: `/projects/${projectId}`,
      badge: request.status,
    });
  }

  for (const invoice of invoiceRows) {
    const invoiceHref = invoice.proposalId
      ? `/proposals/${invoice.proposalId}/sla`
      : "/finanzas/ingresos";
    const total = formatMoney(invoice.totalAmount, invoice.currency ?? "CLP");
    items.push({
      id: `invoice-${invoice.id}`,
      kind: "invoice",
      date: invoice.issuedAt ?? invoice.documentCreatedAt ?? invoice.createdAt,
      title: invoice.folio ? `Factura #${invoice.folio}` : "Factura preparada",
      meta: `${total}${invoice.glosa ? ` · ${invoice.glosa}` : ""}`,
      href: invoiceHref,
      badge: invoice.status,
    });

    if (invoice.status === "Pagado" || invoice.paidAt) {
      items.push({
        id: `payment-${invoice.id}`,
        kind: "payment",
        date: invoice.paidAt ?? invoice.updatedAt,
        title: invoice.folio
          ? `Pago recibido · factura #${invoice.folio}`
          : "Pago recibido",
        meta: total,
        href: invoiceHref,
        badge: "Pagado",
      });
    }
  }

  for (const message of messages) {
    items.push({
      id: `collection-${message.id}`,
      kind: "collection",
      date: message.sentAt ?? message.createdAt,
      title: message.subject,
      meta: COBRANZA_MOMENT_LABELS[message.moment],
      href: `/finanzas/cobranza?clientId=${message.clientId ?? ""}&projectId=${projectId}&moment=${message.moment}`,
      badge: message.status,
    });
  }

  const structuredActivityActions = new Set([
    "meeting_scheduled",
    "proposal_created_from_brief",
    "handoff_asana_created",
    "handoff_registered",
  ]);
  for (const activity of activities) {
    if (structuredActivityActions.has(activity.action)) continue;
    const badge = activity.action.startsWith("stage_changed:")
      ? activity.action.slice("stage_changed:".length)
      : activity.action.startsWith("brief_approved:")
        ? activity.action.slice("brief_approved:".length)
        : undefined;
    items.push({
      id: `activity-${activity.id}`,
      kind: activityKind(activity.entityType, activity.action),
      date: activity.createdAt,
      title: activityTitle(activity.entityType, activity.action),
      href: activity.entityId
        ? activityHref(activity.entityType, activity.entityId, projectId)
        : undefined,
      badge,
    });
  }

  const financeKinds = new Set<ProjectTimelineItem["kind"]>([
    "invoice",
    "payment",
    "collection",
  ]);
  const visible = includeFinance
    ? items
    : items.filter((item) => !financeKinds.has(item.kind));

  return visible.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}
