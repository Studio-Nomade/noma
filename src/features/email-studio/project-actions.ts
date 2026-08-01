"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, emailStudioProjects, projects } from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import {
  emailStudioProjectIdSchema,
  emailStudioProjectStatusSchema,
  normalizeEmailStudioProjectInput,
  type EmailStudioProjectInput,
  type EmailStudioProjectStatus,
} from "./project-schema";

export async function createEmailStudioProject(
  values: EmailStudioProjectInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const data = normalizeEmailStudioProjectInput(values);

    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, data.clientId))
      .limit(1);
    if (!client) return { ok: false, error: "El cliente no existe." };

    if (data.nomaProjectId) {
      const [linkedProject] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, data.nomaProjectId),
            eq(projects.clientId, data.clientId),
          ),
        )
        .limit(1);
      if (!linkedProject) {
        return {
          ok: false,
          error: "El proyecto vinculado debe pertenecer al mismo cliente.",
        };
      }
    }

    const [created] = await db
      .insert(emailStudioProjects)
      .values({ ...data, createdBy: user.id })
      .returning({ id: emailStudioProjects.id });

    revalidatePath("/email-studio");
    return { ok: true, data: created };
  } catch (error) {
    return handleActionError(error, "createEmailStudioProject");
  }
}

export async function setEmailStudioProjectStatus(
  id: string,
  status: EmailStudioProjectStatus,
): Promise<ActionResult> {
  try {
    await requireUser();
    const projectId = emailStudioProjectIdSchema.parse(id);
    const nextStatus = emailStudioProjectStatusSchema.parse(status);
    const [updated] = await db
      .update(emailStudioProjects)
      // Archivar cambia disponibilidad, no el contenido del correo. Mantener
      // updatedAt evita invalidar una exportación ya generada.
      .set({ status: nextStatus })
      .where(eq(emailStudioProjects.id, projectId))
      .returning({ id: emailStudioProjects.id });

    if (!updated) {
      return { ok: false, error: "El proyecto de correo no existe." };
    }

    revalidatePath("/email-studio");
    revalidatePath(`/email-studio/${projectId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "setEmailStudioProjectStatus");
  }
}
