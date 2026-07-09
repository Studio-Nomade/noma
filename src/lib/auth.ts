import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import { roleFor } from "@/lib/roles";
import { devAuthEmail, DEV_USER_ID } from "@/lib/dev-auth";
import type { User } from "@supabase/supabase-js";

/** Usuario sintético para el bypass dev (ver `lib/dev-auth`). */
function devUser(email: string): User {
  return {
    id: DEV_USER_ID,
    email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: { full_name: email.split("@")[0] },
    created_at: new Date(0).toISOString(),
  } as unknown as User;
}

/** Usuario autenticado actual (o null). */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user;
  // Solo dev: si hay bypass configurado, devuelve un usuario sintético.
  const devEmail = devAuthEmail();
  return devEmail ? devUser(devEmail) : null;
}

/** Exige sesión; redirige a /login si no hay. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Perfil interno (team_member) vinculado al usuario, si existe. */
export async function getTeamMember(userId: string) {
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1);
  return member ?? null;
}

/** Exige rol admin (para borrado y configuración global). */
export async function requireAdmin() {
  const user = await requireUser();
  const member = await getTeamMember(user.id);
  // Superadmins/admins por correo (lib/roles) o team_member con rol admin.
  const isAdmin = roleFor(user.email).isAdmin || member?.teamRole === "admin";
  if (!isAdmin) {
    throw new Error("Acción no autorizada: requiere rol admin.");
  }
  return { user, member };
}

/**
 * Exige acceso al módulo de Finanzas (rol de Finanzas por correo, ver `lib/roles`).
 * Si `redirectOnDenied` es true (guard de página), redirige a "/"; si no, lanza
 * (uso en Server Actions).
 */
export async function requireFinance(redirectOnDenied = false): Promise<User> {
  const user = await requireUser();
  if (!roleFor(user.email).isFinance) {
    if (redirectOnDenied) redirect("/");
    throw new Error("Acción no autorizada: requiere acceso a Finanzas.");
  }
  return user;
}
