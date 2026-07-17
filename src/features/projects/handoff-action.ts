"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, clients, cfoRequests, resourceLinks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { createAsanaTask } from "@/features/asana/asana";

/**
 * Traspaso a operación: crea (o registra) la tarea en Asana, genera la
 * solicitud CFO y mueve la oportunidad a "Traspasado a operación".
 */
export async function handoffToOperations(
  projectId: string,
  input: { asanaManualUrl?: string; cfoNotes?: string; proposalId?: string },
): Promise<ActionResult<{ asanaConnected: boolean; asanaReason?: string }>> {
  try {
    const user = await requireUser();

    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
        clientName: clients.companyName,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project) return { ok: false, error: "Oportunidad no encontrada." };

    // 1) Asana: intenta crear la tarea; si no está configurado, usa link manual.
    let asanaUrl = input.asanaManualUrl?.trim() || null;
    const asana = await createAsanaTask({
      name: `${project.clientName} · ${project.name}`,
      notes: `Traspaso a operación desde Noma.\nCliente: ${project.clientName}`,
    });
    let asanaConnected = false;
    let asanaReason: string | undefined;
    if (asana.connected) {
      asanaConnected = true;
      asanaUrl = asana.url ?? asanaUrl;
    } else {
      asanaReason = asana.reason;
    }
    if (asanaUrl) {
      await db.insert(resourceLinks).values({
        entityType: "project",
        entityId: projectId,
        type: "asana",
        label: "Proyecto en Asana",
        url: asanaUrl,
      });
    }

    // 2) Solicitud CFO (idempotente por oportunidad: no duplica si ya hay una).
    const [existingCfo] = await db
      .select({ id: cfoRequests.id })
      .from(cfoRequests)
      .where(eq(cfoRequests.projectId, projectId))
      .limit(1);
    if (!existingCfo) {
      await db.insert(cfoRequests).values({
        projectId,
        proposalId: input.proposalId || null,
        clientId: project.clientId,
        status: "Pendiente",
        notes: input.cfoNotes?.trim() || null,
        requestedBy: user.id,
        requestedByEmail: user.email ?? null,
        createdBy: user.id,
      });
    }

    // 3) Mueve la etapa comercial.
    await db
      .update(projects)
      .set({ commercialStage: "Traspasado a operación", updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await logActivity({
      entityType: "project",
      entityId: projectId,
      action: asanaConnected ? "handoff_asana_created" : "handoff_registered",
      actorId: user.id,
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/pipeline");
    return { ok: true, data: { asanaConnected, asanaReason } };
  } catch (err) {
    return handleActionError(err, "handoffToOperations");
  }
}
