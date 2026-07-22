import { and, asc, count, desc, eq, inArray, like, max } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  clients,
  resourceLinks,
  teamMembers,
  cfoRequests,
  invoices,
  cobranzaMessages,
  activityLog,
  briefs,
  proposals,
  clientContacts,
} from "@/db/schema";
import { toNum } from "@/features/finance/helpers";
import type { Currency } from "@/types/enums";

export type ProjectFinance = {
  invoiced: number;
  receivable: number;
  paid: number;
  collectionCount: number;
};

/** Resumen financiero comercial de una oportunidad. Solo consumir con gating. */
export async function getProjectFinance(
  projectId: string,
): Promise<ProjectFinance> {
  const [invoiceRows, collectionRows] = await Promise.all([
    db
      .select({
        status: invoices.status,
        total: invoices.totalAmount,
        balanceDue: invoices.balanceDue,
      })
      .from(invoices)
      .where(eq(invoices.projectId, projectId)),
    db
      .select({ id: cobranzaMessages.id })
      .from(cobranzaMessages)
      .where(eq(cobranzaMessages.projectId, projectId)),
  ]);

  let invoiced = 0;
  let receivable = 0;
  let paid = 0;
  for (const invoice of invoiceRows) {
    if (invoice.status === "Anulado" || invoice.status === "No facturado") {
      continue;
    }
    const total = toNum(invoice.total);
    invoiced += total;
    if (invoice.status === "Pagado") {
      paid += total;
    } else {
      receivable += toNum(invoice.balanceDue ?? invoice.total);
    }
  }

  return {
    invoiced,
    receivable,
    paid,
    collectionCount: collectionRows.length,
  };
}

/** Solicitud CFO más reciente de una oportunidad (visor de operación). */
export async function getCfoRequest(projectId: string) {
  const [row] = await db
    .select()
    .from(cfoRequests)
    .where(eq(cfoRequests.projectId, projectId))
    .orderBy(desc(cfoRequests.createdAt))
    .limit(1);
  return row ?? null;
}

/** Integrantes activos del equipo (para el desplegable de Responsable). */
export async function listTeamMembers() {
  return db
    .select({ id: teamMembers.id, name: teamMembers.name })
    .from(teamMembers)
    .where(eq(teamMembers.status, "Activo"))
    .orderBy(asc(teamMembers.name));
}

export async function listProjects() {
  const [rows, proposalCounts, briefCounts, stageChanges] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        area: projects.area,
        status: projects.status,
        commercialStage: projects.commercialStage,
        priority: projects.priority,
        responsible: projects.responsible,
        budgetAmount: projects.budgetAmount,
        budgetCurrency: projects.budgetCurrency,
        deliveryDate: projects.deliveryDate,
        nextAction: projects.nextAction,
        updatedAt: projects.updatedAt,
        clientId: projects.clientId,
        clientName: clients.companyName,
        clientEmail: clients.email,
        clientPhone: clients.phone,
        description: projects.description,
        mainObjective: projects.mainObjective,
        internalNotes: projects.internalNotes,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .orderBy(desc(projects.updatedAt)),
    db
      .select({ projectId: proposals.projectId, value: count() })
      .from(proposals)
      .groupBy(proposals.projectId),
    db
      .select({ projectId: briefs.projectId, value: count() })
      .from(briefs)
      .groupBy(briefs.projectId),
    db
      .select({
        projectId: activityLog.entityId,
        changedAt: max(activityLog.createdAt),
      })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.entityType, "project"),
          like(activityLog.action, "stage_changed:%"),
        ),
      )
      .groupBy(activityLog.entityId),
  ]);
  const proposalsByProject = new Map(
    proposalCounts.map((row) => [row.projectId, row.value]),
  );
  const briefsByProject = new Map(
    briefCounts.map((row) => [row.projectId, row.value]),
  );
  const stageByProject = new Map(
    stageChanges.map((row) => [row.projectId, row.changedAt]),
  );
  return rows.map((row) => ({
    ...row,
    proposalCount: proposalsByProject.get(row.id) ?? 0,
    briefCount: briefsByProject.get(row.id) ?? 0,
    stageChangedAt: stageByProject.get(row.id) ?? row.createdAt,
  }));
}

export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number];

export type PipelinePanelData = {
  proposals: {
    id: string;
    title: string;
    status: string;
    amount: string | null;
    currency: Currency | null;
    version: number;
  }[];
  brief: { id: string; status: string; updatedAt: Date } | null;
  links: Awaited<ReturnType<typeof getProjectLinks>>;
  contacts: { name: string | null; email: string; role: string | null }[];
  timeline: import("./timeline").ProjectTimelineItem[];
};

export async function getPipelinePanelData(projectRows: ProjectListItem[]) {
  if (projectRows.length === 0) return {} as Record<string, PipelinePanelData>;
  const projectIds = projectRows.map((project) => project.id);
  const clientIds = [
    ...new Set(projectRows.map((project) => project.clientId)),
  ];
  const [proposalRows, briefRows, linkRows, contactRows, activities] =
    await Promise.all([
      db
        .select({
          id: proposals.id,
          projectId: proposals.projectId,
          title: proposals.title,
          status: proposals.status,
          amount: proposals.estimatedValueAmount,
          currency: proposals.estimatedValueCurrency,
          version: proposals.version,
          createdAt: proposals.createdAt,
        })
        .from(proposals)
        .where(inArray(proposals.projectId, projectIds)),
      db
        .select({
          id: briefs.id,
          projectId: briefs.projectId,
          status: briefs.status,
          updatedAt: briefs.updatedAt,
        })
        .from(briefs)
        .where(inArray(briefs.projectId, projectIds)),
      db
        .select()
        .from(resourceLinks)
        .where(
          and(
            eq(resourceLinks.entityType, "project"),
            inArray(resourceLinks.entityId, projectIds),
          ),
        ),
      db
        .select({
          clientId: clientContacts.clientId,
          name: clientContacts.name,
          email: clientContacts.email,
          role: clientContacts.role,
        })
        .from(clientContacts)
        .where(inArray(clientContacts.clientId, clientIds)),
      db
        .select()
        .from(activityLog)
        .where(
          and(
            eq(activityLog.entityType, "project"),
            inArray(activityLog.entityId, projectIds),
          ),
        )
        .orderBy(desc(activityLog.createdAt)),
    ]);
  return Object.fromEntries(
    projectRows.map((project) => {
      const projectProposals = proposalRows.filter(
        (row) => row.projectId === project.id,
      );
      const projectBrief =
        briefRows.find((row) => row.projectId === project.id) ?? null;
      const timeline: import("./timeline").ProjectTimelineItem[] = [
        {
          id: `created-${project.id}`,
          kind: "lead" as const,
          date: project.createdAt,
          title: "Oportunidad creada",
          badge: "Nuevo lead",
        },
        ...activities
          .filter((row) => row.entityId === project.id)
          .map((row) => ({
            id: row.id,
            kind: "activity" as const,
            date: row.createdAt,
            title: row.action.startsWith("stage_changed:")
              ? "Etapa comercial actualizada"
              : row.action.replaceAll("_", " "),
            meta: row.action.startsWith("stage_changed:")
              ? row.action.split(":")[1]
              : undefined,
          })),
        ...projectProposals.map((row) => ({
          id: `proposal-${row.id}`,
          kind: "proposal" as const,
          date: row.createdAt,
          title: row.title,
          meta: `Propuesta v${row.version}`,
          href: `/proposals/${row.id}`,
          badge: row.status,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return [
        project.id,
        {
          proposals: projectProposals.map((row) => ({
            id: row.id,
            title: row.title,
            status: row.status,
            amount: row.amount,
            currency: row.currency,
            version: row.version,
          })),
          brief: projectBrief
            ? {
                id: projectBrief.id,
                status: projectBrief.status,
                updatedAt: projectBrief.updatedAt,
              }
            : null,
          links: linkRows.filter((row) => row.entityId === project.id),
          contacts: contactRows
            .filter((row) => row.clientId === project.clientId)
            .map((row) => ({
              name: row.name,
              email: row.email,
              role: row.role,
            })),
          timeline,
        } satisfies PipelinePanelData,
      ];
    }),
  );
}

export async function getProject(id: string) {
  const [row] = await db
    .select({
      project: projects,
      clientName: clients.companyName,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.id, id))
    .limit(1);
  return row ?? null;
}

export async function getProjectLinks(projectId: string) {
  return db
    .select()
    .from(resourceLinks)
    .where(
      and(
        eq(resourceLinks.entityType, "project"),
        eq(resourceLinks.entityId, projectId),
      ),
    )
    .orderBy(desc(resourceLinks.createdAt));
}
