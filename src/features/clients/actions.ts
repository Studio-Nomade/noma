"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, projects, invoices } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { clientSchema, type ClientFormValues } from "./schema";

function normalize(values: ClientFormValues) {
  const data = clientSchema.parse(values);
  // Convierte strings vacíos/undefined en null para no guardar vacíos.
  const clean = <T extends Record<string, unknown>>(obj: T) =>
    Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k,
        typeof v === "string" && v.trim() === "" ? null : (v ?? null),
      ]),
    );
  // status nunca debe ser null.
  return { ...clean(data), status: data.status } as typeof data & {
    status: ClientFormValues["status"];
  };
}

export async function createClient(
  values: ClientFormValues,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const data = normalize(values);
    const [row] = await db
      .insert(clients)
      .values({ ...data, createdBy: user.id })
      .returning({ id: clients.id });
    revalidatePath("/clients");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return handleActionError(err, "createClient");
  }
}

export async function updateClient(
  id: string,
  values: ClientFormValues,
): Promise<ActionResult> {
  try {
    await requireUser();
    const data = normalize(values);
    await db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.id, id));
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateClient");
  }
}

/** Marca el cliente como "Cerrado" (no lo elimina). */
export async function closeClient(id: string): Promise<ActionResult> {
  try {
    await requireUser();
    await db
      .update(clients)
      .set({ status: "Cerrado", updatedAt: new Date() })
      .where(eq(clients.id, id));
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "closeClient");
  }
}

/**
 * Elimina un cliente de forma permanente (y sus contactos, por cascada).
 *
 * `projects` e `invoices` referencian clientes con RESTRICT: en vez de dejar que
 * reviente la FK con un error opaco, se comprueba antes y se explica qué lo
 * impide, sugiriendo cerrar el cliente en lugar de borrarlo.
 */
export async function deleteClient(id: string): Promise<ActionResult> {
  try {
    await requireUser();

    const [{ count: projectCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(eq(projects.clientId, id));
    const [{ count: invoiceCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.clientId, id));

    if (projectCount > 0 || invoiceCount > 0) {
      const partes = [
        projectCount > 0 &&
          `${projectCount} ${projectCount === 1 ? "proyecto" : "proyectos"}`,
        invoiceCount > 0 &&
          `${invoiceCount} ${invoiceCount === 1 ? "factura" : "facturas"}`,
      ].filter(Boolean);
      return {
        ok: false,
        error: `No se puede borrar: el cliente tiene ${partes.join(" y ")}. Ciérralo en vez de borrarlo.`,
      };
    }

    const [row] = await db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning({ name: clients.companyName });
    if (!row) return { ok: false, error: "El cliente ya no existe." };

    await logActivity({
      entityType: "client",
      entityId: id,
      action: `client_deleted:${row.name}`,
    });

    revalidatePath("/clients");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "deleteClient");
  }
}
