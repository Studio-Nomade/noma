import { after } from "next/server";
import { resolveBotUserGid } from "@/features/asana/asana";
import {
  storyAddedEvents,
  verifyAsanaSignature,
} from "@/features/asana/webhook-events";
import {
  acceptHandshake,
  getWebhookSecret,
  touchWebhook,
} from "@/features/asana/webhook-store";
import { processAsanaStory } from "@/features/email/deliveries";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Webhook de Asana por proyecto: /api/webhooks/asana?project=<gid>.
 *
 * - Handshake: la primera llamada trae X-Hook-Secret; se guarda cifrado (solo
 *   dentro de la ventana abierta por el script de registro) y se devuelve.
 * - Eventos: se valida X-Hook-Signature (HMAC-SHA256) y los comentarios
 *   nuevos se procesan con `after()` (flujo ENTREGA → correo al cliente).
 */
export async function POST(request: Request) {
  const projectGid = new URL(request.url).searchParams.get("project")?.trim();
  if (!projectGid || !/^\d{1,32}$/.test(projectGid)) {
    return new Response("Bad request", { status: 400 });
  }

  const hookSecret = request.headers.get("x-hook-secret");
  if (hookSecret) {
    const accepted = await acceptHandshake(projectGid, hookSecret);
    if (!accepted) return new Response("Forbidden", { status: 403 });
    return new Response(null, {
      status: 204,
      headers: { "X-Hook-Secret": hookSecret },
    });
  }

  const rawBody = await request.text();
  const secret = await getWebhookSecret(projectGid);
  if (
    !verifyAsanaSignature(
      rawBody,
      request.headers.get("x-hook-signature"),
      secret,
    )
  ) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(null, { status: 204 });
  }
  const events = storyAddedEvents(payload);
  await touchWebhook(projectGid).catch(() => undefined);

  if (events.length) {
    after(async () => {
      let botUserGid: string;
      try {
        botUserGid = await resolveBotUserGid();
      } catch (error) {
        // Sin identidad del bot no se arriesga un loop; el cron reconcilia.
        console.error("[asana:webhook:bot]", error);
        return;
      }
      for (const event of events) {
        if (event.userGid === botUserGid) continue;
        try {
          await processAsanaStory(event.storyGid, { botUserGid });
        } catch (error) {
          console.error("[asana:webhook:story]", event.storyGid, error);
        }
      }
    });
  }
  return new Response(null, { status: 200 });
}
