import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  proposals,
  proposalServices,
  proposalTeam,
  proposalNotes,
  teamMembers,
  services,
  projects,
  clients,
} from "@/db/schema";

export async function listProposals() {
  const rows = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      status: proposals.status,
      version: proposals.version,
      rootId: proposals.rootId,
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

  // Una fila por propuesta: nos quedamos con la versión más alta de cada raíz.
  const latestByRoot = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const key = r.rootId ?? r.id;
    const cur = latestByRoot.get(key);
    if (!cur || r.version > cur.version) latestByRoot.set(key, r);
  }
  return [...latestByRoot.values()].sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
  );
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
      projectAreas: projects.areas,
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
      area: services.area,
      priceAmount: services.priceMinAmount,
      priceCurrency: services.priceCurrency,
      priceType: services.priceType,
      unit: services.unit,
      description: services.description,
      deliverables: services.deliverables,
      requirements: services.requirements,
    })
    .from(proposalServices)
    .innerJoin(services, eq(proposalServices.serviceId, services.id))
    .where(eq(proposalServices.proposalId, proposalId))
    .orderBy(asc(proposalServices.position));
}

export type ProposalServiceRow = Awaited<
  ReturnType<typeof getProposalServices>
>[number];

/** Todas las versiones de una propuesta (misma raíz), ordenadas por versión. */
export async function getProposalVersions(rootId: string) {
  return db
    .select({
      id: proposals.id,
      version: proposals.version,
      status: proposals.status,
      updatedAt: proposals.updatedAt,
    })
    .from(proposals)
    .where(eq(proposals.rootId, rootId))
    .orderBy(asc(proposals.version));
}

/** Hilo de seguimiento (notas) de la propuesta, por raíz. */
export async function getProposalNotes(rootId: string) {
  return db
    .select()
    .from(proposalNotes)
    .where(eq(proposalNotes.rootId, rootId))
    .orderBy(desc(proposalNotes.createdAt));
}

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

const PROPOSAL_TEAM_ORDER = [
  "Anna Sanhueza",
  "Sebastián Robles",
  "Javiera Díaz",
  "Catalina Torres",
  "Luis Salamanca",
  "Carlos Leay",
  "Maximilian Viveros",
  "Hector Briceño",
  "Adrián Silva",
] as const;

/** Integrantes activos del equipo (para el selector de equipo). */
export async function listTeamForSelect() {
  const rows = await db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      roleTitle: teamMembers.roleTitle,
      photoUrl: teamMembers.photoUrl,
    })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.status, "Activo"),
        inArray(teamMembers.name, [...PROPOSAL_TEAM_ORDER]),
      ),
    );
  return rows.sort(
    (a, b) =>
      PROPOSAL_TEAM_ORDER.indexOf(
        a.name as (typeof PROPOSAL_TEAM_ORDER)[number],
      ) -
      PROPOSAL_TEAM_ORDER.indexOf(
        b.name as (typeof PROPOSAL_TEAM_ORDER)[number],
      ),
  );
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

/** Catálogo de servicios activos de varias áreas (proyectos multi-área). */
export async function listServicesForAreas(areas: string[]) {
  const list = areas.length ? areas : ["B&D"];
  return db
    .select()
    .from(services)
    .where(
      and(
        inArray(services.area, list as never[]),
        eq(services.status, "Activo"),
      ),
    )
    .orderBy(asc(services.area), asc(services.subarea), asc(services.name));
}
