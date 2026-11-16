import "server-only";

import type { z } from "zod";
import { callClaudeStructured } from "@/lib/ai/claude";
import { getLLMProvider } from "@/lib/ai/provider";
import type { ClaudeSystemBlock } from "@/lib/ai/structured-body";
import { quoterAiConfig, type QuoterTask } from "./ai-config";

export type QuoterCallResult<T> = {
  data: T;
  provider: "anthropic" | "openai";
  model: string;
  durationMs: number;
};

/** Salida estructurada del cotizador con el proveedor configurado (Claude por defecto). */
export async function quoterStructured<T>(
  task: QuoterTask,
  input: {
    feature: string;
    system: ClaudeSystemBlock[];
    input: string;
    schema: z.ZodType<T>;
    maxTokens: number;
    timeoutMs?: number;
  },
): Promise<QuoterCallResult<T>> {
  const config = quoterAiConfig(task);
  if (!config) throw new Error("La IA del cotizador no está configurada.");
  if (config.provider === "openai") {
    const startedAt = Date.now();
    const data = await getLLMProvider().generateStructured({
      instructions: input.system.map((block) => block.text).join("\n\n"),
      input: input.input,
      schema: input.schema,
      schemaName: input.feature,
      maxOutputTokens: input.maxTokens,
    });
    return {
      data,
      provider: "openai",
      model: config.model,
      durationMs: Date.now() - startedAt,
    };
  }
  const result = await callClaudeStructured({
    feature: input.feature,
    model: config.model,
    effort: config.effort,
    maxTokens: input.maxTokens,
    system: input.system,
    input: input.input,
    schema: input.schema,
    timeoutMs: input.timeoutMs,
  });
  return { ...result, provider: "anthropic" };
}
