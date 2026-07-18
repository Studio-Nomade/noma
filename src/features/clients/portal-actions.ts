"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";

/**
 * Portal del cliente: enlace privado, sin cuenta ni contraseña.
 *
 * Quien tenga el enlace ve el estado de cuenta y los proyectos de ESE cliente,
 * así que el token es la credencial: 32 bytes aleatorios (base64url ≈ 43
 * caracteres), imposible de adivinar o enumerar. Se puede revocar y regenerar.
 */
function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function generatePortalLink(
  clientId: string,
): Promise<ActionResult<{ token: string }>> {
  try {
    const user = await requireUser();
    const token = newToken();
    const [row] = await db
      .update(clients)
      .set({ portalToken: token, portalTokenAt: new Date(), updatedAt: new Date() })
      .where(eq(clients.id, clientId))
      .returning({ id: clients.id });
    if (!row) return { ok: false, error: "Cliente no encontrado." };

    await logActivity({
      entityType: "client",
      entityId: clientId,
      action: "portal_link_generated",
      actorId: user.id,
    });
    revalidatePath(`/clients/${clientId}`);
    return { ok: true, data: { token } };
  } catch (err) {
    return handleActionError(err, "generatePortalLink");
  }
}

/** Revoca el acceso: el enlace anterior deja de funcionar de inmediato. */
export async function revokePortalLink(
  clientId: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await db
      .update(clients)
      .set({ portalToken: null, portalTokenAt: null, updatedAt: new Date() })
      .where(eq(clients.id, clientId));

    await logActivity({
      entityType: "client",
      entityId: clientId,
      action: "portal_link_revoked",
      actorId: user.id,
    });
    revalidatePath(`/clients/${clientId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "revokePortalLink");
  }
}
