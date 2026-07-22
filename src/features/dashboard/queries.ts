import { and, desc, eq, gte, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  projects,
  proposals,
  proposalServices,
  services,
} from "@/db/schema";

export async function getDashboardMetrics() {
  const [activeClients] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clients)
    .where(ne(clients.status, "Cerrado"));

  const [activeProjects] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(projects)
    .where(ne(projects.status, "Cerrado"));

  const [sentProposals] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(proposals)
    .where(eq(proposals.status, "Enviada"));

  // Ingresos potenciales (UF): servicios UF de propuestas enviadas.
  const [potential] = await db
    .select({
      uf: sql<number>`coalesce(sum(${services.priceMinAmount}), 0)::float`,
    })
    .from(proposalServices)
    .innerJoin(services, eq(proposalServices.serviceId, services.id))
    .innerJoin(proposals, eq(proposalServices.proposalId, proposals.id))
    .where(
      and(eq(proposals.status, "Enviada"), eq(services.priceCurrency, "UF")),
    );

  return {
    activeClients: activeClients?.n ?? 0,
    activeProjects: activeProjects?.n ?? 0,
    sentProposals: sentProposals?.n ?? 0,
    potentialUf: Math.round(potential?.uf ?? 0),
  };
}

export async function getNextActions() {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      nextAction: projects.nextAction,
      area: projects.area,
      commercialStage: projects.commercialStage,
      clientName: clients.companyName,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(and(ne(projects.status, "Cerrado"), isNotNull(projects.nextAction)))
    .orderBy(desc(projects.updatedAt))
    .limit(8);
}

export async function getUpcomingDeliveries() {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .select({
      id: projects.id,
      name: projects.name,
      deliveryDate: projects.deliveryDate,
      clientName: clients.companyName,
      status: projects.status,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(
      and(ne(projects.status, "Cerrado"), gte(projects.deliveryDate, today)),
    )
    .orderBy(projects.deliveryDate)
    .limit(6);
}

export async function getPipeline() {
  return db
    .select({
      stage: projects.commercialStage,
      n: sql<number>`count(*)::int`,
    })
    .from(projects)
    .where(ne(projects.status, "Cerrado"))
    .groupBy(projects.commercialStage);
}

export async function getDashboardOpportunities() {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      clientName: clients.companyName,
      stage: projects.commercialStage,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(ne(projects.status, "Cerrado"))
    .orderBy(desc(projects.updatedAt))
    .limit(8);
}
