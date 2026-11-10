import "server-only";

import { getLLMProvider, type GenerateStructuredInput } from "./provider";
import {
  anthropicStructuredBody,
  parseStructuredMessage,
  type AnthropicMessage,
} from "./structured-body";

/**
 * Salida estructurada para el canal de solicitudes (extracción del correo y
 * clasificación de respuestas). Proveedor por `REQUESTS_AI_PROVIDER`:
 *
 * - `anthropic` (por defecto si hay `ANTHROPIC_API_KEY`): Claude con JSON
 *   outputs (`output_config.format`) generados desde el Zod.
 * - `openai`: el proveedor existente (Responses API con JSON Schema estricto).
 *
 * Nunca cambia de proveedor por su cuenta: si el elegido no tiene key,
 * devuelve null y el flujo usa la heurística sin IA.
 */

export type StructuredFn = <T>(input: GenerateStructuredInput<T>) => Promise<T>;

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

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

async function anthropicStructured<T>(
  input: GenerateStructuredInput<T>,
): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("Claude no está configurado.");
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(anthropicStructuredBody(input)),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    // Solo el tipo y mensaje del error de la API (no repiten el correo).
    throw new Error(
      `Claude respondió ${response.status}${await anthropicErrorDetail(response)}.`,
    );
  }
  return parseStructuredMessage(
    (await response.json()) as AnthropicMessage,
    input.schema,
  );
}

async function anthropicErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { type?: string; message?: string };
    };
    const type = body.error?.type ?? "";
    const message = (body.error?.message ?? "").slice(0, 160);
    return type || message
      ? ` (${[type, message].filter(Boolean).join(": ")})`
      : "";
  } catch {
    return "";
  }
}
