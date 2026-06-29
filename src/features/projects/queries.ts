import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, clients, resourceLinks, teamMembers } from "@/db/schema";

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
