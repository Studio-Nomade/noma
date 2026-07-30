import { after } from "next/server";
import { enqueueEvent, parseInbound } from "@/features/whatsapp/inbound";
import { processPending } from "@/features/whatsapp/processor";
import { verifySignature } from "@/features/whatsapp/verify";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (
    expected &&
    mode === "subscribe" &&
    token === expected &&
    challenge !== null
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 403 });
  }

  try {
    const payload = JSON.parse(rawBody) as unknown;
    const messages = parseInbound(payload);
    for (const message of messages) {
      await enqueueEvent(message.waMessageId, message);
    }
    if (messages.length) {
      after(async () => {
        await processPending();
      });
    }
  } catch (error) {
    console.error("[whatsapp:webhook]", error);
  }

  return Response.json({ received: true });
}
