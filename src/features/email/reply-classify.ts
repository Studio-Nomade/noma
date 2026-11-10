/**
 * Clasificación de la respuesta del cliente en el hilo, para elegir el acuse:
 *
 * | Tipo        | Condición                                   | Correo | Asana                                  |
 * |-------------|---------------------------------------------|--------|----------------------------------------|
 * | approval    | aprueba sin pedir cambios y hay entrega     | 06     | Aprobado · completa · Ticket Finalizado |
 * | adjustments | pide cambios sobre una entrega              | 05     | Con ajustes (reabre si estaba cerrada) |
 * | info        | trae datos, archivos o responde una consulta | 02     | comentario (+ fecha/prioridad)          |
 * | question    | pregunta algo                               | 02     | comentario                              |
 * | empty       | solo agradece o dice "ok"                   | —      | comentario                              |
 * | ambiguous   | no está claro (p. ej. si aprueba)           | 02     | Estado = Por revisar                    |
 *
 * Seguridad: sin entrega enviada no hay aprobación ni ajustes (se tratan como
 * info), y una aprobación con cambios es ajustes. La llamada al modelo es
 * inyectable; sin IA no se envía acuse (solo queda el comentario). Módulo puro.
 */

import { z } from "zod";
import type { StructuredGenerator } from "./extract";
import { PRIORITIES } from "./extract";
import {
  STUDIO_TIME_ZONE,
  formatSpanishDate,
  localDateParts,
  normalizeDueDate,
  toIsoDate,
} from "./dates";

export const REPLY_KINDS = [
  "approval",
  "adjustments",
  "info",
  "question",
  "empty",
  "ambiguous",
] as const;
export type ReplyKind = (typeof REPLY_KINDS)[number];

export const replyClassificationSchema = z.object({
  kind: z
    .enum(REPLY_KINDS)
    .describe(
      "approval: aprueba la entrega sin pedir cambios ('aprobado', 'perfecto así', 'publiquemos'). adjustments: pide cambios sobre la entrega, aunque también diga que le gustó. info: aporta datos, archivos o responde una consulta. question: hace una pregunta al estudio. empty: solo agradece o confirma recepción sin contenido. ambiguous: no está claro si aprueba o pide cambios.",
    ),
  points: z
    .array(z.string())
    .describe(
      "Lo que aporta el mensaje, en frases cortas en segunda persona ('La entrega es para el viernes 13'). Máx. 5. Vacío si es empty.",
    ),
  adjustments: z
    .array(
      z.object({
        text: z.string().describe("El cambio pedido, en una frase imperativa."),
        reference: z
          .string()
          .nullable()
          .describe(
            "Minuto, lámina, página o parte ('0:45', 'Inicio', 'Lámina 3'), o null.",
          ),
      }),
    )
    .describe("Cambios pedidos, uno por ítem, solo si kind = adjustments."),
  doubts: z
    .array(z.string())
    .describe(
      "Dudas que el estudio debería confirmar para no equivocarse con los ajustes (máx. 2), o vacío.",
    ),
  new_due_date: z
    .string()
    .nullable()
    .describe(
      "Nueva fecha de entrega pedida (YYYY-MM-DD) o null si no la menciona.",
    ),
  new_priority: z
    .enum(PRIORITIES)
    .nullable()
    .describe(
      "Nueva prioridad si el cliente la cambia explícitamente, o null.",
    ),
  new_format: z
    .string()
    .nullable()
    .describe("Formato, medidas o duración si los define o cambia, o null."),
});

export type ReplyClassification = z.infer<typeof replyClassificationSchema>;

export type ReplyContext = {
  folio: string;
  title: string;
  /** Ronda de la última entrega enviada (null si aún no hay). */
  lastDeliveryRound: number | null;
  /** Preguntas de la última CONSULTA enviada, si hay. */
  openQuestions: string[];
  fromName: string | null;
  date: Date;
  body: string;
};

const INSTRUCTIONS = [
  "Eres el coordinador de solicitudes de Studio Nomade, un estudio de diseño.",
  "Recibes la respuesta de un cliente dentro del hilo de una solicitud y la clasificas.",
  "Responde en español de Chile y SOLO con el objeto estructurado. No inventes datos.",
  "Si no hay una entrega enviada, el mensaje no puede ser approval ni adjustments.",
  "Ante cualquier duda entre approval y adjustments, usa ambiguous.",
  "Ignora firmas, avisos legales y texto citado de correos anteriores.",
].join("\n");

export function buildReplyPrompt(context: ReplyContext) {
  const local = toIsoDate(localDateParts(context.date, STUDIO_TIME_ZONE));
  return [
    `Solicitud: ${context.folio} · ${context.title}`,
    `Fecha del mensaje (America/Santiago): ${formatSpanishDate(local)} (${local})`,
    context.lastDeliveryRound
      ? `Última entrega enviada: Entrega ${String(context.lastDeliveryRound).padStart(2, "0")}`
      : "Aún no hay entregas enviadas.",
    context.openQuestions.length
      ? `Preguntas abiertas del estudio:\n${context.openQuestions.map((q) => `- ${q}`).join("\n")}`
      : "",
    `De: ${context.fromName ?? "cliente"}`,
    "",
    "Mensaje:",
    context.body.slice(0, 8_000),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Normaliza y aplica las reglas de seguridad sobre la salida del modelo. */
export function normalizeReplyClassification(
  raw: ReplyClassification,
  context: Pick<ReplyContext, "lastDeliveryRound" | "date">,
): ReplyClassification {
  const clean = (items: string[], max: number) =>
    items
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, max);
  const adjustments = raw.adjustments
    .map((item) => ({
      text: item.text.replace(/\s+/g, " ").trim(),
      reference: item.reference?.trim() || null,
    }))
    .filter((item) => item.text)
    .slice(0, 15);
  let kind: ReplyKind = raw.kind;
  const hasDelivery = Boolean(context.lastDeliveryRound);
  if (kind === "approval" && adjustments.length) kind = "adjustments";
  if (kind === "adjustments" && !adjustments.length) kind = "ambiguous";
  if (!hasDelivery && (kind === "approval" || kind === "adjustments")) {
    kind = "info";
  }
  if (!hasDelivery && kind === "ambiguous") kind = "info";
  const points = clean(raw.points, 5);
  return {
    kind,
    points:
      kind === "info" && !points.length && adjustments.length
        ? adjustments.map((item) => item.text).slice(0, 5)
        : points,
    adjustments: kind === "adjustments" ? adjustments : [],
    doubts: clean(raw.doubts, 2),
    new_due_date: normalizeDueDate(raw.new_due_date, context.date),
    new_priority: raw.new_priority,
    new_format: raw.new_format?.replace(/\s+/g, " ").trim() || null,
  };
}

export type ReplyClassificationResult = {
  classification: ReplyClassification | null;
  error: string | null;
};

export async function classifyReply(
  context: ReplyContext,
  generate: StructuredGenerator | null,
): Promise<ReplyClassificationResult> {
  if (!generate) return { classification: null, error: "IA no configurada" };
  if (!context.body.trim()) {
    return {
      classification: {
        kind: "empty",
        points: [],
        adjustments: [],
        doubts: [],
        new_due_date: null,
        new_priority: null,
        new_format: null,
      },
      error: null,
    };
  }
  try {
    const raw = await generate({
      instructions: INSTRUCTIONS,
      input: buildReplyPrompt(context),
      schema: replyClassificationSchema,
      schemaName: "email_reply_classification",
      maxOutputTokens: 4_096,
    });
    return {
      classification: normalizeReplyClassification(raw, context),
      error: null,
    };
  } catch (error) {
    return {
      classification: null,
      error:
        error instanceof Error ? error.message.slice(0, 300) : "Error de IA",
    };
  }
}
