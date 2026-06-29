"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { clientSchema, type ClientFormValues } from "./schema";

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string };

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
    return { ok: false, error: errorMessage(err) };
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
    return { ok: false, error: errorMessage(err) };
  }
}

/** Los clientes no se eliminan: se marcan como "Cerrado". */
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
    return { ok: false, error: errorMessage(err) };
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Ocurrió un error inesperado.";
}
