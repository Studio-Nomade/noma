import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  briefs,
  briefMeetings,
  briefNotes,
  briefVersions,
  projects,
  clients,
} from "@/db/schema";

/** Notas importadas de una oportunidad (más recientes primero). */
export async function listBriefNotes(projectId: string) {
  return db
    .select()
    .from(briefNotes)
    .where(eq(briefNotes.projectId, projectId))
    .orderBy(desc(briefNotes.createdAt));
}

/** Historial de versiones del brief. */
export async function listBriefVersions(briefId: string) {
  return db
    .select()
    .from(briefVersions)
    .where(eq(briefVersions.briefId, briefId))
    .orderBy(desc(briefVersions.version));
}

/** Reuniones de brief de una oportunidad (cronológicas). */
export async function listBriefMeetings(projectId: string) {
  return db
    .select()
    .from(briefMeetings)
    .where(eq(briefMeetings.projectId, projectId))
    .orderBy(asc(briefMeetings.startsAt));
}

export type BriefMeetingRow = Awaited<
  ReturnType<typeof listBriefMeetings>
>[number];

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
