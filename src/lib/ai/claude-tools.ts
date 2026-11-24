import "server-only";

import { anthropicErrorDetail, recordAiUsage } from "./claude";
import { usageFromMessage } from "./structured-body";

/**
 * Conversación con Claude usando herramientas (tool use). El servidor ejecuta
 * cada herramienta que Claude pide y le devuelve el resultado, hasta que
 * Claude responde con texto o se agotan las vueltas.
 *
 * Mismas reglas que `callClaudeStructured`: la key no sale del servidor y en
 * `ai_usage` solo se guarda modelo, tokens y tiempo (por vuelta), con el
 * `feature` que permite medir el consumo de cada agente.
 */

export type ClaudeTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  run: (input: Record<string, unknown>) => Promise<unknown>;
};

type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

export type ClaudeTurn = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

type ToolMessage = {
  model?: string;
  stop_reason?: string;
  content?: ContentBlock[];
  usage?: Parameters<typeof usageFromMessage>[0]["usage"];
};

function messagesUrl() {
  const base =
    process.env.ANTHROPIC_BASE_URL?.trim().replace(/\/+$/, "") ||
    "https://api.anthropic.com";
  return `${base}/v1/messages`;
}

export async function runClaudeWithTools(input: {
  feature: string;
  model: string;
  system: string;
  messages: ClaudeTurn[];
  tools: ClaudeTool[];
  maxTokens?: number;
  maxRounds?: number;
  timeoutMs?: number;
}): Promise<{ text: string; toolCalls: { name: string; ok: boolean }[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("Claude no está configurado.");
  const messages: ClaudeTurn[] = [...input.messages];
  const toolCalls: { name: string; ok: boolean }[] = [];
  const byName = new Map(input.tools.map((t) => [t.name, t]));
  const rounds = input.maxRounds ?? 6;

  for (let round = 0; round < rounds; round++) {
    const startedAt = Date.now();
    const response = await fetch(messagesUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens ?? 2_048,
        system: [
          {
            type: "text",
            text: input.system,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: input.tools.map(({ name, description, input_schema }) => ({
          name,
          description,
          input_schema,
        })),
        messages,
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 60_000),
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
    const message = (await response.json()) as ToolMessage;
    await recordAiUsage({
      feature: input.feature,
      model: message.model ?? input.model,
      durationMs: Date.now() - startedAt,
      ok: true,
      ...usageFromMessage(message),
    });
    const content = message.content ?? [];
    const uses = content.filter(
      (b): b is Extract<ContentBlock, { type: "tool_use" }> =>
        b.type === "tool_use",
    );
    if (message.stop_reason !== "tool_use" || !uses.length) {
      const text = content
        .filter(
          (b): b is Extract<ContentBlock, { type: "text" }> =>
            b.type === "text",
        )
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { text, toolCalls };
    }
    messages.push({ role: "assistant", content });
    const results: ContentBlock[] = [];
    for (const use of uses) {
      const tool = byName.get(use.name);
      try {
        if (!tool) throw new Error(`Herramienta desconocida: ${use.name}`);
        const out = await tool.run(use.input ?? {});
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: JSON.stringify(out).slice(0, 20_000),
        });
        toolCalls.push({ name: use.name, ok: true });
      } catch (error) {
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: error instanceof Error ? error.message : "Error",
          is_error: true,
        });
        toolCalls.push({ name: use.name, ok: false });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return {
    text: "No alcancé a terminar la respuesta; prueba con una pregunta más acotada.",
    toolCalls,
  };
}
