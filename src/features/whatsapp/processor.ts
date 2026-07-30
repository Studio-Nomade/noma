import "server-only";

import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  botAuthorizedSenders,
  botChannels,
  botConversations,
  botMessages,
  whatsappInboundEvents,
} from "@/db/schema";
import { runAgentTurn } from "@/features/bot/agent";
import { notifyUnknownWhatsAppSender } from "@/features/bot/notify";
import { sendText } from "./client";
import {
  inboundEventPayloadSchema,
  normalizeWhatsAppPhone,
} from "./inbound";

const UNKNOWN_SENDER_MESSAGE =
  "Este número no está habilitado para enviar solicitudes. Contacta a tu equipo de Studio Nomade para acreditarlo.";
const AGENT_FALLBACK_MESSAGE =
  "Gracias por escribirnos. No pude ordenar tu solicitud en este momento, pero el mensaje quedó registrado para que el equipo pueda retomarlo.";

export async function processPending({
  limit = 10,
  includeFailed = false,
}: { limit?: number; includeFailed?: boolean } = {}) {
  const events = await claimPending(
    Math.max(1, Math.min(limit, 50)),
    includeFailed,
  );
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

async function claimPending(limit: number, includeFailed: boolean) {
  return db.transaction(async (tx) => {
    const events = await tx
      .select()
      .from(whatsappInboundEvents)
      .where(
        includeFailed
          ? or(
              eq(whatsappInboundEvents.status, "pending"),
              and(
                eq(whatsappInboundEvents.status, "failed"),
                lt(whatsappInboundEvents.attempts, 5),
              ),
            )
          : eq(whatsappInboundEvents.status, "pending"),
      )
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
      senderName: botAuthorizedSenders.displayName,
      senderProfile: botAuthorizedSenders.profile,
      channelId: botChannels.id,
      projectId: botChannels.projectId,
      clientId: botChannels.clientId,
      asanaProjectGid: botChannels.asanaProjectGid,
      contextPack: botChannels.contextPack,
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
    await notifyUnknownWhatsAppSender(phone);
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

  const responseState = await getResponseState(
    conversation.id,
    payload.waMessageId,
  );
  if (responseState.completed) {
    await markDone(eventId, null);
    return;
  }

  if (!isWithinCustomerCareWindow(inboundAt)) {
    if (!responseState.fallback) {
      await db.insert(botMessages).values({
        conversationId: conversation.id,
        role: "assistant",
        content: AGENT_FALLBACK_MESSAGE,
        meta: {
          agent: "fallback",
          sourceMessageId: payload.waMessageId,
          delivery: "blocked_24h",
          reason: "El mensaje se procesó fuera de la ventana de atención de 24h.",
        },
      });
    }
    await markDone(
      eventId,
      "Respuesta bloqueada: fuera de la ventana de atención de 24h.",
    );
    return;
  }

  let agentTurn: Awaited<ReturnType<typeof runAgentTurn>>;
  try {
    agentTurn = await runAgentTurn({
      botChannel: {
        id: resolved.channelId,
        projectId: resolved.projectId,
        clientId: resolved.clientId,
        asanaProjectGid: resolved.asanaProjectGid,
        contextPack: resolved.contextPack,
      },
      conversationId: conversation.id,
      userText: payload.text,
      sourceMessageId: payload.waMessageId,
      sender: {
        id: resolved.senderId,
        displayName: resolved.senderName,
        profile: resolved.senderProfile,
      },
    });
  } catch (error) {
    if (!responseState.fallback) {
      const delivery = await sendText(phone, AGENT_FALLBACK_MESSAGE);
      await db.insert(botMessages).values({
        conversationId: conversation.id,
        role: "assistant",
        content: AGENT_FALLBACK_MESSAGE,
        meta: {
          agent: "fallback",
          sourceMessageId: payload.waMessageId,
          delivery: delivery.connected ? "sent" : "degraded",
          ...(delivery.connected
            ? { waMessageId: delivery.id }
            : { reason: delivery.reason }),
        },
      });
    }
    const reason =
      error instanceof Error ? error.message : "Error desconocido del agente";
    throw new Error(`El agente no pudo responder: ${reason}`);
  }

  for (const toolEvent of agentTurn.toolEvents) {
    await db.insert(botMessages).values({
      conversationId: conversation.id,
      role: "tool",
      content: JSON.stringify(toolEvent.result),
      meta: {
        sourceMessageId: payload.waMessageId,
        tool: toolEvent.name,
        arguments: toolEvent.arguments,
        result: toolEvent.result,
      },
    });
  }

  const delivery = await sendText(phone, agentTurn.text);
  await db.insert(botMessages).values({
    conversationId: conversation.id,
    role: "assistant",
    content: agentTurn.text,
    meta: delivery.connected
      ? {
          sourceMessageId: payload.waMessageId,
          delivery: "sent",
          waMessageId: delivery.id,
        }
      : {
          sourceMessageId: payload.waMessageId,
          delivery: "degraded",
          reason: delivery.reason,
        },
  });
  await markDone(eventId, delivery.connected ? null : delivery.reason);
}

async function getResponseState(
  conversationId: string,
  sourceMessageId: string,
) {
  const rows = await db
    .select({ meta: botMessages.meta })
    .from(botMessages)
    .where(
      and(
        eq(botMessages.conversationId, conversationId),
        eq(botMessages.role, "assistant"),
        sql`${botMessages.meta}->>'sourceMessageId' = ${sourceMessageId}`,
      ),
    );
  return {
    fallback: rows.some((row) => row.meta?.agent === "fallback"),
    completed: rows.some((row) => row.meta?.agent !== "fallback"),
  };
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

function isWithinCustomerCareWindow(lastInboundAt: Date) {
  const elapsed = Date.now() - lastInboundAt.getTime();
  return elapsed >= -5 * 60 * 1_000 && elapsed <= 24 * 60 * 60 * 1_000;
}
