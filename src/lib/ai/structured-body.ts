import { z } from "zod";
import type { GenerateStructuredInput } from "./provider";

/**
 * Partes puras de la salida estructurada con Claude (sin `server-only`, para
 * poder probarlas): el cuerpo de la llamada y la lectura de la respuesta.
 */

export const DEFAULT_REQUESTS_ANTHROPIC_MODEL = "claude-sonnet-5-5";

/** JSON Schema para `output_config.format` (objeto, sin `$schema`). */
export function outputJsonSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<
    string,
    unknown
  >;
  delete json.$schema;
  return json;
}

/**
 * Cuerpo de la llamada a Claude con JSON outputs (`output_config.format`).
 *
 * Claude Sonnet/Opus 5.5 rechazan `tool_choice` forzado ("tool"/"any") con un
 * 400, así que la salida estructurada va por JSON outputs: la respuesta trae un
 * bloque de texto con el JSON que cumple el schema. El razonamiento siempre
 * está activo en estos modelos; `effort` controla cuánto (bajo para extraer).
 */
export function anthropicStructuredBody<T>(
  input: GenerateStructuredInput<T>,
  env: Record<string, string | undefined> = process.env,
) {
  return {
    model:
      env.REQUESTS_ANTHROPIC_MODEL?.trim() || DEFAULT_REQUESTS_ANTHROPIC_MODEL,
    max_tokens: input.maxOutputTokens ?? 8_192,
    system: input.instructions,
    messages: [{ role: "user", content: input.input }],
    output_config: {
      effort: env.REQUESTS_ANTHROPIC_EFFORT?.trim() || "low",
      format: {
        type: "json_schema",
        schema: outputJsonSchema(input.schema as z.ZodType),
      },
    },
  };
}

export type AnthropicMessage = {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
};

/** Extrae y valida el JSON del bloque de texto (ignora bloques de razonamiento). */
export function parseStructuredMessage<T>(
  body: AnthropicMessage,
  schema: GenerateStructuredInput<T>["schema"],
): T {
  const stop = body.stop_reason ?? "?";
  const text = (body.content ?? [])
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("")
    .trim();
  if (!text) {
    throw new Error(
      `Claude no devolvió una salida estructurada (stop_reason: ${stop}).`,
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`Salida de Claude no es JSON (stop_reason: ${stop}).`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Rutas y códigos de Zod, sin valores del correo.
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "(raíz)"}:${issue.code}`)
      .join(", ");
    throw new Error(
      `Salida de Claude inválida (stop_reason: ${stop}; ${issues}).`,
    );
  }
  return parsed.data;
}
