import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  botAuthorizedSenders,
  botChannels,
  botConversations,
  botMessages,
  whatsappInboundEvents,
} from "@/db/schema";
import { sendText } from "./client";
import {
  inboundEventPayloadSchema,
  normalizeWhatsAppPhone,
} from "./inbound";

const UNKNOWN_SENDER_MESSAGE =
  "Este número no está habilitado para enviar solicitudes. Contacta a tu equipo de Studio Nomade para acreditarlo.";

export async function processPending({ limit = 10 }: { limit?: number } = {}) {
  const events = await claimPending(Math.max(1, Math.min(limit, 50)));
  const results: { id: string; status: "done" | "failed" }[] = [];

  for (const event of events) {
    try {
      const payload = inboundEventPayloadSchema.parse(event.payload);
      await processEvent(event.id, payload);
      results.push({ id: event.id, status: "done" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "Error desconocido";
      await db
        .update(whatsappInboundEvents)
        .set({
          status: "failed",
          error: message,
          updatedAt: new Date(),
        })
        .where(eq(whatsappInboundEvents.id, event.id));
      results.push({ id: event.id, status: "failed" });
    }
  }
  return results;
}

async function claimPending(limit: number) {
  return db.transaction(async (tx) => {
    const events = await tx
      .select()
      .from(whatsappInboundEvents)
      .where(eq(whatsappInboundEvents.status, "pending"))
      .orderBy(asc(whatsappInboundEvents.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (!events.length) return [];

    await tx
      .update(whatsappInboundEvents)
      .set({
        status: "processing",
        attempts: sql`${whatsappInboundEvents.attempts} + 1`,
        error: null,
        updatedAt: new Date(),
      })
      .where(inArray(whatsappInboundEvents.id, events.map((event) => event.id)));
    return events;
  });
}

async function processEvent(
  eventId: string,
  payload: {
    waMessageId: string;
    from: string;
    text: string;
    timestamp: string | null;
  },
) {
  const phone = normalizeWhatsAppPhone(payload.from);
  const [resolved] = await db
    .select({
      senderId: botAuthorizedSenders.id,
      channelId: botChannels.id,
      projectId: botChannels.projectId,
      clientId: botChannels.clientId,
    })
    .from(botAuthorizedSenders)
    .innerJoin(
      botChannels,
      eq(botAuthorizedSenders.botChannelId, botChannels.id),
    )
    .where(
      and(
        eq(botAuthorizedSenders.phone, phone),
        eq(botAuthorizedSenders.status, "active"),
        eq(botChannels.status, "active"),
      ),
    )
    .limit(1);

  if (!resolved) {
    const delivery = await sendText(phone, UNKNOWN_SENDER_MESSAGE);
    await markDone(eventId, delivery.connected ? null : delivery.reason);
    return;
  }

  const inboundAt = toInboundDate(payload.timestamp);
  const conversation = await getOrCreateConversation({
    channelId: resolved.channelId,
    senderId: resolved.senderId,
    phone,
    inboundAt,
  });

  await db
    .insert(botMessages)
    .values({
      conversationId: conversation.id,
      role: "user",
      content: payload.text,
      waMessageId: payload.waMessageId,
      meta: { source: "whatsapp" },
    })
    .onConflictDoNothing();

  const responseText = `Recibí tu mensaje: “${payload.text}”. En el siguiente paso lo ordenaremos contigo antes de enviarlo al equipo.`;
  const delivery = await sendText(phone, responseText);
  await db.insert(botMessages).values({
    conversationId: conversation.id,
    role: "assistant",
    content: responseText,
    meta: delivery.connected
      ? { delivery: "sent", waMessageId: delivery.id }
      : { delivery: "degraded", reason: delivery.reason },
  });
  await markDone(eventId, delivery.connected ? null : delivery.reason);
}

async function getOrCreateConversation(input: {
  channelId: string;
  senderId: string;
  phone: string;
  inboundAt: Date;
}) {
  const [existing] = await db
    .select({ id: botConversations.id })
    .from(botConversations)
    .where(
      and(
        eq(botConversations.botChannelId, input.channelId),
        eq(botConversations.senderId, input.senderId),
        eq(botConversations.status, "open"),
      ),
    )
    .limit(1);
  if (existing) {
    await db
      .update(botConversations)
      .set({ lastInboundAt: input.inboundAt, updatedAt: new Date() })
      .where(eq(botConversations.id, existing.id));
    return existing;
  }

  const [created] = await db
    .insert(botConversations)
    .values({
      botChannelId: input.channelId,
      senderId: input.senderId,
      phone: input.phone,
      lastInboundAt: input.inboundAt,
    })
    .onConflictDoNothing()
    .returning({ id: botConversations.id });
  if (created) return created;

  // Otro worker pudo abrir la conversación entre el SELECT y el INSERT.
  const [winner] = await db
    .select({ id: botConversations.id })
    .from(botConversations)
    .where(
      and(
        eq(botConversations.botChannelId, input.channelId),
        eq(botConversations.phone, input.phone),
        eq(botConversations.status, "open"),
      ),
    )
    .limit(1);
  if (!winner) throw new Error("No se pudo abrir la conversación de WhatsApp.");
  await db
    .update(botConversations)
    .set({ lastInboundAt: input.inboundAt, updatedAt: new Date() })
    .where(eq(botConversations.id, winner.id));
  return winner;
}

async function markDone(eventId: string, deliveryReason: string | null) {
  await db
    .update(whatsappInboundEvents)
    .set({
      status: "done",
      error: deliveryReason,
      updatedAt: new Date(),
    })
    .where(eq(whatsappInboundEvents.id, eventId));
}

function toInboundDate(timestamp: string | null) {
  if (!timestamp) return new Date();
  const seconds = Number(timestamp);
  const value = new Date(seconds * 1000);
  return Number.isNaN(value.getTime()) ? new Date() : value;
}
