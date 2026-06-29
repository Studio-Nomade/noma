import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import type { User } from "@supabase/supabase-js";

/** Usuario autenticado actual (o null). */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
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
  if (member?.teamRole !== "admin") {
    throw new Error("Acción no autorizada: requiere rol admin.");
  }
  return { user, member };
}
