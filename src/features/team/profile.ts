import "server-only";
import { eq, or } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { db } from "@/db";
import { teamMembers } from "@/db/schema";

/**
 * Vincula (o crea) el perfil de equipo del usuario recién autenticado con los
 * datos que entrega Google: nombre y foto.
 *
 * Nota: Google solo comparte nombre, email y foto en el perfil básico. Cargo y
 * firma de correo NO vienen de ahí — se editan a mano en /profile.
 *
 * Al enlazar, solo rellena campos vacíos: nunca pisa lo que el colaborador ya
 * editó (p. ej. su cargo o una foto propia).
 */
export async function syncTeamMemberFromGoogle(user: User): Promise<void> {
  const email = user.email?.toLowerCase();
  if (!email) return;

  const meta = user.user_metadata ?? {};
  const googleName =
    (meta.full_name as string) || (meta.name as string) || null;
  const googlePhoto =
    (meta.avatar_url as string) || (meta.picture as string) || null;

  // Busca por user_id (ya enlazado) o por email (fila del seed sin enlazar).
  const [existing] = await db
    .select()
    .from(teamMembers)
    .where(or(eq(teamMembers.userId, user.id), eq(teamMembers.email, email)))
    .limit(1);

  if (existing) {
    await db
      .update(teamMembers)
      .set({
        userId: user.id,
        email: existing.email ?? email,
        name: existing.name || googleName || email,
        photoUrl: existing.photoUrl ?? googlePhoto,
        updatedAt: new Date(),
      })
      .where(eq(teamMembers.id, existing.id));
    return;
  }

  await db.insert(teamMembers).values({
    userId: user.id,
    email,
    name: googleName || email,
    photoUrl: googlePhoto,
    status: "Activo",
  });
}

/** Perfil de equipo del usuario actual (por user_id, o email como respaldo). */
export async function getCurrentTeamMember(user: User) {
  const email = user.email?.toLowerCase() ?? "";
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(or(eq(teamMembers.userId, user.id), eq(teamMembers.email, email)))
    .limit(1);
  return member ?? null;
}
