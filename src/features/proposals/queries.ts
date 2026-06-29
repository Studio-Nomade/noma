import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  proposals,
  proposalServices,
  proposalTeam,
  teamMembers,
  services,
  projects,
  clients,
} from "@/db/schema";

export async function listProposals() {
  return db
    .select({
      id: proposals.id,
      title: proposals.title,
      status: proposals.status,
      version: proposals.version,
      updatedAt: proposals.updatedAt,
      estimatedValueAmount: proposals.estimatedValueAmount,
      estimatedValueCurrency: proposals.estimatedValueCurrency,
      projectId: proposals.projectId,
      clientName: clients.companyName,
      projectName: projects.name,
    })
    .from(proposals)
    .innerJoin(projects, eq(proposals.projectId, projects.id))
    .leftJoin(clients, eq(proposals.clientId, clients.id))
    .orderBy(desc(proposals.updatedAt));
}

export type ProposalListItem = Awaited<
  ReturnType<typeof listProposals>
>[number];

export async function getProposal(id: string) {
  const [row] = await db
    .select({
      proposal: proposals,
      clientName: clients.companyName,
      projectName: projects.name,
      projectArea: projects.area,
    })
    .from(proposals)
    .innerJoin(projects, eq(proposals.projectId, projects.id))
    .leftJoin(clients, eq(proposals.clientId, clients.id))
    .where(eq(proposals.id, id))
    .limit(1);
  return row ?? null;
}

/** Servicios incluidos en la propuesta, con datos del servicio. */
export async function getProposalServices(proposalId: string) {
  return db
    .select({
      id: proposalServices.id,
      serviceId: proposalServices.serviceId,
      position: proposalServices.position,
      customPriceAmount: proposalServices.customPriceAmount,
      customPriceCurrency: proposalServices.customPriceCurrency,
      name: services.name,
      subarea: services.subarea,
      priceAmount: services.priceMinAmount,
      priceCurrency: services.priceCurrency,
      unit: services.unit,
    })
    .from(proposalServices)
    .innerJoin(services, eq(proposalServices.serviceId, services.id))
    .where(eq(proposalServices.proposalId, proposalId))
    .orderBy(asc(proposalServices.position));
}

export type ProposalServiceRow = Awaited<
  ReturnType<typeof getProposalServices>
>[number];

/** Equipo de la propuesta (con datos del integrante). */
export async function getProposalTeam(proposalId: string) {
  return db
    .select({
      id: proposalTeam.id,
      memberId: proposalTeam.memberId,
      roleInProject: proposalTeam.roleInProject,
      position: proposalTeam.position,
      name: teamMembers.name,
      roleTitle: teamMembers.roleTitle,
      photoUrl: teamMembers.photoUrl,
    })
    .from(proposalTeam)
    .innerJoin(teamMembers, eq(proposalTeam.memberId, teamMembers.id))
    .where(eq(proposalTeam.proposalId, proposalId))
    .orderBy(asc(proposalTeam.position));
}

export type ProposalTeamRow = Awaited<
  ReturnType<typeof getProposalTeam>
>[number];

/** Integrantes activos del equipo (para el selector de equipo). */
export async function listTeamForSelect() {
  return db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      roleTitle: teamMembers.roleTitle,
      photoUrl: teamMembers.photoUrl,
    })
    .from(teamMembers)
    .where(eq(teamMembers.status, "Activo"))
    .orderBy(asc(teamMembers.name));
}

export type TeamSelectRow = Awaited<
  ReturnType<typeof listTeamForSelect>
>[number];

/** Catálogo de servicios activos de un área (para el selector). */
export async function listServicesForArea(area: string) {
  return db
    .select()
    .from(services)
    .where(and(eq(services.area, area as never), eq(services.status, "Activo")))
    .orderBy(asc(services.subarea), asc(services.name));
}
