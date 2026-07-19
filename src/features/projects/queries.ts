import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  clients,
  resourceLinks,
  teamMembers,
  cfoRequests,
  invoices,
  cobranzaMessages,
} from "@/db/schema";
import { toNum } from "@/features/finance/helpers";

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
  return db
    .select({
      id: projects.id,
      name: projects.name,
      area: projects.area,
      status: projects.status,
      commercialStage: projects.commercialStage,
      priority: projects.priority,
      nextAction: projects.nextAction,
      updatedAt: projects.updatedAt,
      clientId: projects.clientId,
      clientName: clients.companyName,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .orderBy(desc(projects.updatedAt));
}

export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number];

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
