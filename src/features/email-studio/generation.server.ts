import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import {
  DEFAULT_EMAIL_STUDIO_OPENAI_MODEL,
  resolveEmailStudioAi,
  type EmailStudioAiProvider,
} from "./ai-config";
import {
  emailStudioGenerationPlanSchema,
  type EmailStudioGenerationPlan,
} from "./generation-plan";
import {
  ANTHROPIC_MESSAGES_URL,
  ANTHROPIC_VERSION,
  buildAnthropicPlanRequest,
  buildPlanUserText,
  EMAIL_PLAN_INSTRUCTIONS,
  EmailStudioProviderError,
  MAX_GENERATION_ASSETS,
  parseAnthropicPlanResponse,
  type EmailStudioGenerationTelemetry,
  type GenerationInput,
} from "./generation-request";

export type {
  EmailStudioGenerationTelemetry,
  GenerationAsset,
  GenerationReference,
} from "./generation-request";

type GenerationResult = {
  plan: EmailStudioGenerationPlan;
  telemetry: EmailStudioGenerationTelemetry;
};

/**
 * Genera el plan con el proveedor configurado (ADR-008). Lanza si el
 * proveedor no tiene key: quien llama decide caer al armado manual.
 */
export async function generateEmailPlan(
  input: GenerationInput,
): Promise<GenerationResult & { provider: EmailStudioAiProvider }> {
  const config = resolveEmailStudioAi();
  if (!config.configured) {
    throw new Error(config.reason ?? "IA de Email Studio no configurada.");
  }
  if (config.provider === "openai") {
    return {
      provider: "openai",
      ...(await generateEmailPlanWithOpenAI(input, config.model)),
    };
  }
  return {
    provider: "anthropic",
    ...(await generateEmailPlanWithAnthropic(input, config.model)),
  };
}

export async function generateEmailPlanWithAnthropic(
  input: GenerationInput,
  model: string,
): Promise<GenerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Claude no está configurado.");
  }
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(buildAnthropicPlanRequest(input, model)),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    // No se registra el cuerpo: puede repetir partes del prompt.
    throw new EmailStudioProviderError(
      `Claude respondió ${response.status}.`,
      response.status,
    );
  }
  return parseAnthropicPlanResponse(await response.json());
}

export async function generateEmailPlanWithOpenAI(
  input: GenerationInput,
  model: string = DEFAULT_EMAIL_STUDIO_OPENAI_MODEL,
): Promise<GenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OpenAI no está configurado.");
  }

  const content: ResponseInputContent[] = [
    { type: "input_text", text: buildPlanUserText(input) },
  ];

  if (input.reference.mimeType === "application/pdf") {
    content.push({
      type: "input_file",
      file_url: input.reference.url,
      filename: input.reference.filename,
      detail: "high",
    });
  } else {
    content.push({
      type: "input_image",
      image_url: input.reference.url,
      detail: "original",
    });
  }

  for (const asset of input.assets.slice(0, MAX_GENERATION_ASSETS)) {
    content.push({
      type: "input_text",
      text: `Asset ${asset.id}: ${asset.label}`,
    });
    content.push({
      type: "input_image",
      image_url: asset.url,
      detail: "high",
    });
  }

  const client = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });
  const response = await client.responses.parse(
    {
      model,
      instructions: EMAIL_PLAN_INSTRUCTIONS,
      input: [{ role: "user", content }],
      text: {
        format: zodTextFormat(
          emailStudioGenerationPlanSchema,
          "email_studio_plan",
        ),
      },
      reasoning: { effort: "low" },
      max_output_tokens: 4_000,
      store: false,
    },
    { signal: AbortSignal.timeout(60_000) },
  );

  if (!response.output_parsed) {
    throw new Error("OpenAI no devolvió un plan utilizable.");
  }
  return {
    plan: emailStudioGenerationPlanSchema.parse(response.output_parsed),
    telemetry: {
      responseId: response.id,
      model: response.model,
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
      totalTokens: response.usage?.total_tokens ?? null,
    },
  };
}
