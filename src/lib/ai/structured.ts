import "server-only";

import { z } from "zod";
import { getLLMProvider, type GenerateStructuredInput } from "./provider";

/**
 * Salida estructurada para el canal de solicitudes (extracción del correo y
 * clasificación de respuestas). Proveedor por `REQUESTS_AI_PROVIDER`:
 *
 * - `anthropic` (por defecto si hay `ANTHROPIC_API_KEY`): Claude con una
 *   herramienta forzada cuyo `input_schema` es el JSON Schema del Zod.
 * - `openai`: el proveedor existente (Responses API con JSON Schema estricto).
 *
 * Nunca cambia de proveedor por su cuenta: si el elegido no tiene key,
 * devuelve null y el flujo usa la heurística sin IA.
 */

export type StructuredFn = <T>(input: GenerateStructuredInput<T>) => Promise<T>;

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
export const DEFAULT_REQUESTS_ANTHROPIC_MODEL = "claude-sonnet-5-5";

export function requestsAiProvider(
  env: Record<string, string | undefined> = process.env,
): "anthropic" | "openai" | null {
  const raw = env.REQUESTS_AI_PROVIDER?.trim().toLowerCase();
  if (raw === "openai") return env.OPENAI_API_KEY?.trim() ? "openai" : null;
  if (raw === "anthropic" || raw === "claude") {
    return env.ANTHROPIC_API_KEY?.trim() ? "anthropic" : null;
  }
  if (env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  if (env.OPENAI_API_KEY?.trim()) return "openai";
  return null;
}

export function requestsStructuredGenerator(): StructuredFn | null {
  const provider = requestsAiProvider();
  if (provider === "openai") {
    return (input) => getLLMProvider().generateStructured(input);
  }
  if (provider === "anthropic") return anthropicStructured;
  return null;
}

/** JSON Schema para `input_schema` (objeto, sin `$schema`). */
export function toolInputSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<
    string,
    unknown
  >;
  delete json.$schema;
  return json;
}

async function anthropicStructured<T>(
  input: GenerateStructuredInput<T>,
): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("Claude no está configurado.");
  const toolName = input.schemaName
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 64);
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model:
        process.env.REQUESTS_ANTHROPIC_MODEL?.trim() ||
        DEFAULT_REQUESTS_ANTHROPIC_MODEL,
      max_tokens: input.maxOutputTokens ?? 2_000,
      system: input.instructions,
      messages: [{ role: "user", content: input.input }],
      tools: [
        {
          name: toolName,
          description: "Devuelve el resultado estructurado.",
          input_schema: toolInputSchema(input.schema as z.ZodType),
        },
      ],
      tool_choice: { type: "tool", name: toolName },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    // No se registra el cuerpo: puede repetir partes del correo del cliente.
    throw new Error(`Claude respondió ${response.status}.`);
  }
  const body = (await response.json()) as {
    content?: { type: string; name?: string; input?: unknown }[];
  };
  const block = body.content?.find(
    (item) => item.type === "tool_use" && item.name === toolName,
  );
  if (!block) throw new Error("Claude no devolvió una salida estructurada.");
  return input.schema.parse(block.input);
}
