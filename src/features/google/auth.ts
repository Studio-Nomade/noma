import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userIntegrations } from "@/db/schema";

/**
 * Autenticación con Google como el usuario (refresh token guardado en
 * `user_integrations`). Compartido por Gmail (envío), Calendar/Meet y Drive.
 *
 * Requiere GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en el entorno y que el
 * usuario haya concedido los scopes al iniciar sesión.
 */

/** Error tipado para permitir degradación elegante (reunión local sin Google). */
export class GoogleAuthError extends Error {
  constructor(
    message: string,
    readonly reason: "no_token" | "no_config" | "refresh_failed" = "no_token",
  ) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

/** Devuelve un access token de Google para el usuario, o lanza GoogleAuthError. */
export async function getGoogleAccessToken(userId: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GoogleAuthError(
      "Falta configurar GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.",
      "no_config",
    );
  }

  const [row] = await db
    .select({ token: userIntegrations.googleRefreshToken })
    .from(userIntegrations)
    .where(eq(userIntegrations.userId, userId))
    .limit(1);
  if (!row?.token) {
    throw new GoogleAuthError(
      "Tu cuenta no tiene acceso de Google concedido. Cierra sesión y vuelve a entrar.",
      "no_token",
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.token,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new GoogleAuthError(
      "No se pudo renovar el acceso a Google. Reintenta el login.",
      "refresh_failed",
    );
  }
  return json.access_token;
}
