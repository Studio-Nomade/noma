import "server-only";

import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import {
  claudeStructuredBody,
  parseStructuredMessage,
  usageFromMessage,
  type AnthropicMessage,
  type ClaudeStructuredRequest,
} from "./structured-body";

/**
 * Llamada server-side a Claude con salida JSON validada por Zod.
 *
 * Reglas (ADR-004, ADR-008, ADR-009): la key nunca sale del servidor, no se
 * guardan prompts ni respuestas en `ai_usage` (solo modelo, tokens y tiempo) y
 * los errores solo exponen tipo y mensaje de la API.
 */

// `ANTHROPIC_BASE_URL` (opcional) permite un proxy o un servidor de prueba local.
function messagesUrl() {
  const base =
    process.env.ANTHROPIC_BASE_URL?.trim().replace(/\/+$/, "") ||
    "https://api.anthropic.com";
  return `${base}/v1/messages`;
}
const ANTHROPIC_VERSION = "2023-06-01";

export function claudeConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim());
}

export type ClaudeCallInput<T> = Omit<ClaudeStructuredRequest, "schema"> & {
  /** Nombre corto para `ai_usage.feature` (p. ej. `quoter_draft`). */
  feature: string;
  schema: import("zod").ZodType<T>;
  timeoutMs?: number;
};

export async function callClaudeStructured<T>(
  input: ClaudeCallInput<T>,
): Promise<{ data: T; model: string; durationMs: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("Claude no está configurado.");
  const body = claudeStructuredBody(input);
  const startedAt = Date.now();
  const response = await fetch(messagesUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(input.timeoutMs ?? 120_000),
  });
  if (!response.ok) {
    const detail = await anthropicErrorDetail(response);
    await recordAiUsage({
      feature: input.feature,
      model: input.model,
      durationMs: Date.now() - startedAt,
      ok: false,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    throw new Error(`Claude respondió ${response.status}${detail}.`);
  }
  const message = (await response.json()) as AnthropicMessage;
  const durationMs = Date.now() - startedAt;
  let ok = false;
  try {
    const data = parseStructuredMessage(message, input.schema);
    ok = true;
    return { data, model: message.model ?? input.model, durationMs };
  } finally {
    await recordAiUsage({
      feature: input.feature,
      model: message.model ?? input.model,
      durationMs,
      ok,
      ...usageFromMessage(message),
    });
  }
}

/** Registro best-effort del consumo: nunca hace fallar la llamada. */
export async function recordAiUsage(row: {
  feature: string;
  model: string;
  durationMs: number;
  ok: boolean;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  provider?: string;
}) {
  console.info(
    `[ai:usage] ${row.feature} ${row.model} in=${row.inputTokens} out=${row.outputTokens} cache=${row.cacheReadTokens}/${row.cacheWriteTokens} ${row.durationMs}ms${row.ok ? "" : " (inválida)"}`,
  );
  try {
    await db
      .insert(aiUsage)
      .values({ ...row, provider: row.provider ?? "anthropic" });
  } catch (error) {
    console.error("[ai:usage] no se pudo registrar", error);
  }
}

export async function anthropicErrorDetail(
  response: Response,
): Promise<string> {
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
