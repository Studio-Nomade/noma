/**
 * Rutas de API que se autentican por sí mismas y NO deben pasar por la sesión
 * Supabase del middleware.
 *
 * - `/api/webhooks/*`: Meta (firma HMAC), Gmail Pub/Sub (token/OIDC) y Asana
 *   (handshake + X-Hook-Signature). Ninguno tiene cookie de sesión: sin este
 *   bypass, el middleware los redirige a /login y el proveedor recibe un 307.
 * - `/api/cron/*`: Vercel Cron, autenticado con `Authorization: Bearer CRON_SECRET`.
 *
 * Cada handler DEBE validar su propia credencial; este listado solo evita la
 * redirección. Módulo edge-safe (sin Node/DB): lo importa el middleware.
 */
export const SELF_AUTHENTICATED_PREFIXES = [
  "/api/webhooks",
  "/api/cron",
] as const;

/** ¿La ruta se autentica sola (webhook/cron) y debe saltarse la sesión? */
export function isSelfAuthenticatedPath(pathname: string): boolean {
  // Se exige el separador "/" para no abrir prefijos vecinos
  // (p. ej. `/api/webhooksfoo` o `/api/cronjobs`).
  return SELF_AUTHENTICATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
