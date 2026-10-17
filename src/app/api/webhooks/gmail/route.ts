import { after } from "next/server";
import { GmailApiError, requestsMailbox } from "@/features/email/inbox";
import { processPendingEmails } from "@/features/email/processor";
import {
  decodePushBody,
  safeEqual,
  verifyGoogleOidcToken,
} from "@/features/email/pubsub";
import { syncMailboxHistory } from "@/features/email/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Push de Gmail vía Cloud Pub/Sub (suscripción push a
 * /api/webhooks/gmail?token=NOMA_GMAIL_PUSH_TOKEN).
 *
 * Autenticación: token compartido obligatorio y, si se define
 * NOMA_GMAIL_PUSH_AUDIENCE, el JWT OIDC de Pub/Sub. Encola los mensajes nuevos
 * (history.list) antes de responder —si falla, Pub/Sub reintenta— y procesa
 * la cola con `after()` para responder rápido.
 */
export async function POST(request: Request) {
  const expected = process.env.NOMA_GMAIL_PUSH_TOKEN?.trim();
  if (!expected) return new Response("Not configured", { status: 503 });
  const url = new URL(request.url);
  if (!safeEqual(url.searchParams.get("token"), expected)) {
    return new Response("Forbidden", { status: 403 });
  }

  const audience = process.env.NOMA_GMAIL_PUSH_AUDIENCE?.trim();
  if (audience) {
    const authorization = request.headers.get("authorization") ?? "";
    const jwt = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";
    const valid =
      jwt &&
      (await verifyGoogleOidcToken(jwt, {
        audience,
        serviceAccountEmail:
          process.env.NOMA_GMAIL_PUSH_SERVICE_ACCOUNT?.trim() || null,
      }));
    if (!valid) return new Response("Forbidden", { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Mensaje inválido: se confirma para que Pub/Sub no lo reintente.
    return new Response(null, { status: 204 });
  }
  const notification = decodePushBody(body);
  if (!notification || notification.emailAddress !== requestsMailbox()) {
    return new Response(null, { status: 204 });
  }

  try {
    const result = await syncMailboxHistory(notification.historyId);
    if (result.enqueued > 0) {
      after(async () => {
        await processPendingEmails({ limit: 10 }).catch((error) => {
          console.error("[email:webhook:process]", error);
        });
      });
    }
  } catch (error) {
    console.error("[email:webhook:sync]", error);
    // Error de configuración (sin casilla/token): no sirve reintentar; el cron
    // reconcilia cuando se corrija. Errores transitorios → 500 → reintento.
    if (error instanceof GmailApiError && error.status === 0) {
      return new Response(null, { status: 204 });
    }
    return new Response("Sync failed", { status: 500 });
  }
  return new Response(null, { status: 204 });
}
