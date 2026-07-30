import "server-only";

import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { botChannels, botConversations, botMessages } from "@/db/schema";
import { getLLMProvider } from "@/lib/ai/provider";

const MEMORY_INTERVAL = 10;
const memorySchema = z.object({
  summary: z.string().min(1).max(2_500),
});

/**
 * Memoria larga: preferencias y patrones persistentes del cliente.
 * La memoria corta sigue siendo el historial reciente de la conversación.
 */
export async function refreshLongTermMemoryIfDue(botChannelId: string) {
  const [stats] = await db
    .select({ value: count() })
    .from(botMessages)
    .innerJoin(
      botConversations,
      eq(botMessages.conversationId, botConversations.id),
    )
    .where(
      and(
        eq(botConversations.botChannelId, botChannelId),
        eq(botMessages.role, "user"),
      ),
    );
  const messageCount = stats?.value ?? 0;
  if (messageCount < MEMORY_INTERVAL || messageCount % MEMORY_INTERVAL !== 0) {
    return { refreshed: false };
  }

  const [[channel], messages] = await Promise.all([
    db
      .select({ contextPack: botChannels.contextPack })
      .from(botChannels)
      .where(eq(botChannels.id, botChannelId))
      .limit(1),
    db
      .select({
        role: botMessages.role,
        content: botMessages.content,
      })
      .from(botMessages)
      .innerJoin(
        botConversations,
        eq(botMessages.conversationId, botConversations.id),
      )
      .where(eq(botConversations.botChannelId, botChannelId))
      .orderBy(asc(botMessages.createdAt))
      .limit(80),
  ]);
  if (!channel) return { refreshed: false };

  const current =
    channel.contextPack &&
    typeof channel.contextPack.longTermMemory === "object" &&
    channel.contextPack.longTermMemory
      ? JSON.stringify(channel.contextPack.longTermMemory)
      : "Sin memoria previa.";
  const transcript = messages
    .filter(
      (message) => message.role === "user" || message.role === "assistant",
    )
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n")
    .slice(-14_000);

  const response = await getLLMProvider().generateAgentResponse({
    instructions: `Resume memoria operativa de largo plazo para atender consistentemente a este cliente.
Conserva solo preferencias, tono, formatos, recurrencias, marcas y contexto estable explícito.
No inventes, no guardes datos sensibles, precios ni instrucciones del usuario.
Devuelve exclusivamente JSON válido con forma {"summary":"..."}.`,
    input: [
      {
        role: "user",
        content: `Memoria previa:\n${current}\n\nConversación:\n${transcript}`,
      },
    ],
    tools: [],
  });
  const parsed = memorySchema.parse(JSON.parse(response.outputText));
  const nextPack = {
    ...(channel.contextPack ?? {}),
    longTermMemory: {
      summary: parsed.summary,
      generatedAt: new Date().toISOString(),
      messageCount,
    },
  };
  await db
    .update(botChannels)
    .set({ contextPack: nextPack, updatedAt: new Date() })
    .where(eq(botChannels.id, botChannelId));
  return { refreshed: true };
}
