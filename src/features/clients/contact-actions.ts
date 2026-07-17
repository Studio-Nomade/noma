"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientContacts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { CONTACT_PROFILES, type ContactProfile } from "@/types/enums";

/** Filtra perfiles desconocidos (el input puede venir de un CSV o del cliente). */
function cleanProfiles(input?: string[]): ContactProfile[] {
  if (!input?.length) return [];
  const valid = input.filter((p): p is ContactProfile =>
    CONTACT_PROFILES.includes(p as ContactProfile),
  );
  return [...new Set(valid)];
}

export async function addClientContact(
  clientId: string,
  input: {
    name?: string;
    email: string;
    role?: string;
    isPrimary?: boolean;
    profiles?: string[];
  },
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
      profiles: cleanProfiles(input.profiles),
    });
    revalidatePath(`/clients/${clientId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "addClientContact");
  }
}

/** Cambia los perfiles de un contacto ya creado (checkboxes de la ficha). */
export async function setContactProfiles(
  contactId: string,
  clientId: string,
  profiles: string[],
): Promise<ActionResult> {
  try {
    await requireUser();
    await db
      .update(clientContacts)
      .set({ profiles: cleanProfiles(profiles), updatedAt: new Date() })
      .where(eq(clientContacts.id, contactId));
    revalidatePath(`/clients/${clientId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "setContactProfiles");
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
