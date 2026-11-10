import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  anthropicStructuredBody,
  parseStructuredMessage,
  usageFromMessage,
} from "./structured-body";

const schema = z.object({ title: z.string(), urgent: z.boolean() });

test("usa JSON outputs y no fuerza herramientas (Claude 5.5)", () => {
  const body = anthropicStructuredBody(
    {
      instructions: "Extrae.",
      input: "Hola",
      schema,
      schemaName: "demo",
    },
    {},
  );
  assert.equal(body.model, "claude-sonnet-5-5");
  assert.equal(body.output_config.effort, "low");
  assert.equal(body.output_config.format.type, "json_schema");
  const json = body.output_config.format.schema;
  assert.equal(json.type, "object");
  assert.equal(json.additionalProperties, false);
  assert.equal("$schema" in json, false);
  assert.equal("tools" in body, false);
  assert.equal("tool_choice" in body, false);
});

test("respeta modelo y effort por entorno", () => {
  const body = anthropicStructuredBody(
    { instructions: "", input: "", schema, schemaName: "x" },
    {
      REQUESTS_ANTHROPIC_MODEL: "claude-opus-5-5",
      REQUESTS_ANTHROPIC_EFFORT: "medium",
    },
  );
  assert.equal(body.model, "claude-opus-5-5");
  assert.equal(body.output_config.effort, "medium");
});

test("lee el JSON del bloque de texto e ignora el razonamiento", () => {
  const value = parseStructuredMessage(
    {
      content: [
        { type: "thinking" },
        { type: "text", text: '{"title":"Carrusel","urgent":true}' },
      ],
      stop_reason: "end_turn",
    },
    schema,
  );
  assert.deepEqual(value, { title: "Carrusel", urgent: true });
});

test("errores sin repetir el contenido", () => {
  assert.throws(
    () =>
      parseStructuredMessage(
        { content: [], stop_reason: "max_tokens" },
        schema,
      ),
    /stop_reason: max_tokens/,
  );
  assert.throws(
    () =>
      parseStructuredMessage(
        { content: [{ type: "text", text: "secreto no json" }] },
        schema,
      ),
    (error: Error) =>
      /no es JSON/.test(error.message) && !error.message.includes("secreto"),
  );
  assert.throws(
    () =>
      parseStructuredMessage(
        { content: [{ type: "text", text: '{"title":"dato privado"}' }] },
        schema,
      ),
    (error: Error) =>
      /urgent/.test(error.message) && !error.message.includes("dato privado"),
  );
});

test("lee el consumo de tokens de la respuesta", () => {
  assert.deepEqual(
    usageFromMessage({
      usage: {
        input_tokens: 1820,
        output_tokens: 640,
        cache_read_input_tokens: 0,
      },
    }),
    {
      inputTokens: 1820,
      outputTokens: 640,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
  );
  assert.deepEqual(usageFromMessage({}), {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  });
});
