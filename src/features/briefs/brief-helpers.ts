import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { briefs, projects } from "@/db/schema";
import type { Brief } from "@/db/schema";

/** Obtiene el brief del proyecto o lo crea vacío (uno por proyecto). */
export async function ensureBrief(
  projectId: string,
  userId: string,
): Promise<Brief> {
  const [existing] = await db
    .select()
    .from(briefs)
    .where(eq(briefs.projectId, projectId))
    .limit(1);
  if (existing) return existing;

  const [project] = await db
    .select({
      name: projects.name,
      area: projects.area,
      areas: projects.areas,
      clientId: projects.clientId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) throw new Error("Oportunidad no encontrada.");

  const [row] = await db
    .insert(briefs)
    .values({
      projectId,
      clientId: project.clientId,
      area: project.area,
      projectName: project.name,
      involvedAreas: project.areas.filter((a) => a !== project.area),
      status: "Sin reunión agendada",
      createdBy: userId,
    })
    .returning();
  return row;
}
