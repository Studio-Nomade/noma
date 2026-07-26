import "server-only";
import {
  resolveEmailSender,
  type ResolvedEmailSender,
} from "@/features/email/signatures";

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

export type CobranzaSender = ResolvedEmailSender;

/** Resuelve la casilla remitente (userId + email) o explica por qué no se puede enviar. */
export async function resolveCobranzaSender(): Promise<CobranzaSender> {
  return resolveEmailSender("commercial");
}
