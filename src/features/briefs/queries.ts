import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { briefs, projects, clients } from "@/db/schema";

export async function getBriefByProject(projectId: string) {
  const [row] = await db
    .select()
    .from(briefs)
    .where(eq(briefs.projectId, projectId))
    .limit(1);
  return row ?? null;
}

/** Proyectos con el estado de su brief (para el listado). */
export async function listProjectsWithBrief() {
  return db
    .select({
      projectId: projects.id,
      name: projects.name,
      area: projects.area,
      clientName: clients.companyName,
      updatedAt: projects.updatedAt,
      briefStatus: briefs.status,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(briefs, eq(briefs.projectId, projects.id))
    .orderBy(desc(projects.updatedAt));
}

/** Proyecto + brief (para el editor). */
export async function getProjectForBrief(projectId: string) {
  const [row] = await db
    .select({
      id: projects.id,
      name: projects.name,
      area: projects.area,
      clientId: projects.clientId,
      clientName: clients.companyName,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.id, projectId))
    .orderBy(asc(projects.name))
    .limit(1);
  return row ?? null;
}
