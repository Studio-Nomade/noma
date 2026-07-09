/**
 * Bypass de autenticación SOLO para desarrollo local.
 *
 * Cuando `NOMA_DEV_AUTH_EMAIL` está definido y NODE_ENV !== "production", la app
 * trata al usuario como autenticado con ese correo, sin pasar por Google/Supabase.
 * Sirve para ver el desarrollo (incluido el módulo CFO) en local sin configurar
 * OAuth. En producción SIEMPRE se ignora (doble guarda: NODE_ENV + ausencia del env).
 *
 * Este módulo es edge-safe (sin Node/DB): lo usa el middleware y el server auth.
 */

// UUID fijo y válido para el usuario de desarrollo (created_by / actor_id).
export const DEV_USER_ID = "d0000000-0000-4000-8000-000000000001";

/** Devuelve el correo del usuario dev si el bypass está activo; si no, null. */
export function devAuthEmail(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const email = process.env.NOMA_DEV_AUTH_EMAIL?.trim();
  return email ? email.toLowerCase() : null;
}
