"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientContacts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";

export async function addClientContact(
  clientId: string,
  input: { name?: string; email: string; role?: string; isPrimary?: boolean },
): Promise<ActionResult> {
  try {
    await requireUser();
    const email = input.email.trim();
    if (!email) return { ok: false, error: "El email es obligatorio." };
    await db.insert(clientContacts).values({
      clientId,
      email,
      name: input.name?.trim() || null,
      role: input.role?.trim() || null,
      isPrimary: input.isPrimary ?? false,
    });
    revalidatePath(`/clients/${clientId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "addClientContact");
  }
}

export async function deleteClientContact(
  contactId: string,
  clientId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db.delete(clientContacts).where(eq(clientContacts.id, contactId));
    revalidatePath(`/clients/${clientId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "deleteClientContact");
  }
}
