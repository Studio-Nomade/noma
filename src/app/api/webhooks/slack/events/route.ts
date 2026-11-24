import { after } from "next/server";
import {
  handleSlackMessageEvent,
  type SlackMessageEvent,
} from "@/features/slack-agent/agent";
import { verifySlackSignature } from "@/features/slack-agent/signature";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Events API de Slack para la app Noma: mensajes directos con Sebastián y Ana
 * (conversación) y «[SOLICITUD]» en #general-finanzas (tarea en CFO).
 * Verifica la firma, responde en < 3 s y procesa después con `after()`.
 * Los reintentos de Slack se ignoran: el primer envío ya quedó en proceso.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const ok = verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET?.trim(),
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
    body,
  });
  if (!ok) return new Response("firma inválida", { status: 401 });

  let payload: {
    type?: string;
    challenge?: string;
    event_id?: string;
    event?: SlackMessageEvent;
  };
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("json inválido", { status: 400 });
  }
  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }
  if (request.headers.get("x-slack-retry-num")) {
    return new Response("ok");
  }
  const event = payload.event;
  if (
    payload.type === "event_callback" &&
    event?.type === "message" &&
    payload.event_id
  ) {
    const eventId = payload.event_id;
    after(async () => {
      try {
        await handleSlackMessageEvent(event, eventId);
      } catch (error) {
        console.error("[slack:events]", error);
      }
    });
  }
  return new Response("ok");
}
