import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userIntegrations } from "@/db/schema";

/**
 * Remitente de cobranza. Por requerimiento, los correos salen SIEMPRE desde
 * `sales@studionomade.cl` (configurable con NOMA_COBRANZA_FROM), sin importar
 * quién los dispare.
 *
 * Gmail envía como el dueño del token, así que para que el "From" sea sales@
 * necesitamos el refresh token de esa casilla. Se resuelve buscando en
 * `user_integrations` la fila cuyo email coincide con el remitente (esa cuenta
 * debe haber iniciado sesión en Noma al menos una vez).
 */
export function cobranzaFromEmail(): string {
  return (
    process.env.NOMA_COBRANZA_FROM?.trim().toLowerCase() ||
    "sales@studionomade.cl"
  );
}

export type CobranzaSender =
  | { ok: true; userId: string; from: string }
  | { ok: false; from: string; reason: string };

/** Resuelve la casilla remitente (userId + email) o explica por qué no se puede enviar. */
export async function resolveCobranzaSender(): Promise<CobranzaSender> {
  const from = cobranzaFromEmail();

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return {
      ok: false,
      from,
      reason:
        "Falta configurar GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en el entorno.",
    };
  }

  const [row] = await db
    .select({
      userId: userIntegrations.userId,
      token: userIntegrations.googleRefreshToken,
    })
    .from(userIntegrations)
    .where(eq(userIntegrations.email, from))
    .limit(1);

  if (!row?.userId || !row.token) {
    return {
      ok: false,
      from,
      reason: `La casilla remitente (${from}) no ha autorizado el envío. Debe iniciar sesión en Noma una vez con esa cuenta.`,
    };
  }

  return { ok: true, userId: row.userId, from };
}
