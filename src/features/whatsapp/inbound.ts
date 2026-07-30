import "server-only";

import { z } from "zod";
import { db } from "@/db";
import { whatsappInboundEvents } from "@/db/schema";

const metaMessageSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  timestamp: z.string().optional(),
  type: z.string().optional(),
  text: z.object({ body: z.string() }).optional(),
});

export const inboundEventPayloadSchema = z.object({
  waMessageId: z.string().min(1),
  from: z.string().min(1),
  text: z.string(),
  timestamp: z.string().nullable(),
});

export type ParsedInboundMessage = z.infer<typeof inboundEventPayloadSchema>;

type MetaPayload = {
  entry?: {
    changes?: {
      value?: {
        messages?: unknown[];
      };
    }[];
  }[];
};

export function parseInbound(payload: unknown): ParsedInboundMessage[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as MetaPayload;
  const parsed: ParsedInboundMessage[] = [];

  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const rawMessage of change.value?.messages ?? []) {
        const result = metaMessageSchema.safeParse(rawMessage);
        if (!result.success || result.data.type !== "text") continue;
        const body = result.data.text?.body?.trim();
        if (!body) continue;
        parsed.push({
          waMessageId: result.data.id,
          from: normalizeWhatsAppPhone(result.data.from),
          text: body,
          timestamp: result.data.timestamp ?? null,
        });
      }
    }
  }
  return parsed;
}

export function normalizeWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : value.trim();
}

export async function enqueueEvent(
  waMessageId: string,
  payload: ParsedInboundMessage,
) {
  const [inserted] = await db
    .insert(whatsappInboundEvents)
    .values({ waMessageId, payload })
    .onConflictDoNothing({ target: whatsappInboundEvents.waMessageId })
    .returning({ id: whatsappInboundEvents.id });
  return { inserted: Boolean(inserted), id: inserted?.id ?? null };
}
