"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clientRequests } from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";

const requestIdSchema = z.string().uuid("Solicitud inválida.");
const scopeSchema = z.enum(["in_scope", "additional", "unknown"]);

export async function closeRequest(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const requestId = requestIdSchema.parse(id);
    const [updated] = await db
      .update(clientRequests)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(clientRequests.id, requestId))
      .returning({ id: clientRequests.id });
    if (!updated) return { ok: false, error: "Solicitud no encontrada." };
    await logActivity({
      entityType: "client_request",
      entityId: requestId,
      action: "request_closed",
      actorId: user.id,
    });
    revalidatePath("/solicitudes");
    revalidatePath(`/solicitudes/${requestId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "closeRequest");
  }
}

export async function updateRequestScope(
  id: string,
  scopeClass: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const requestId = requestIdSchema.parse(id);
    const scope = scopeSchema.parse(scopeClass);
    const [existing] = await db
      .select({
        scopeClass: clientRequests.scopeClass,
        predictedScopeClass: clientRequests.predictedScopeClass,
      })
      .from(clientRequests)
      .where(eq(clientRequests.id, requestId))
      .limit(1);
    if (!existing) return { ok: false, error: "Solicitud no encontrada." };
    const corrected =
      scope !== (existing.predictedScopeClass ?? existing.scopeClass);
    const [updated] = await db
      .update(clientRequests)
      .set({
        scopeClass: scope,
        scopeCorrectedAt: corrected ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(clientRequests.id, requestId))
      .returning({ id: clientRequests.id });
    if (!updated) return { ok: false, error: "Solicitud no encontrada." };
    await logActivity({
      entityType: "client_request",
      entityId: requestId,
      action: `scope_corrected:${scope}`,
      actorId: user.id,
    });
    revalidatePath("/solicitudes");
    revalidatePath(`/solicitudes/${requestId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "updateRequestScope");
  }
}
