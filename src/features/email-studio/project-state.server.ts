import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailStudioProjects } from "@/db/schema";

export async function getEditableEmailStudioProject(projectId: string) {
  const [project] = await db
    .select({
      id: emailStudioProjects.id,
      clientId: emailStudioProjects.clientId,
      status: emailStudioProjects.status,
    })
    .from(emailStudioProjects)
    .where(eq(emailStudioProjects.id, projectId))
    .limit(1);

  if (!project) return { ok: false as const, error: "Proyecto no encontrado." };
  if (project.status !== "active") {
    return {
      ok: false as const,
      error: "Restaura el proyecto antes de editarlo.",
    };
  }
  return { ok: true as const, project };
}
