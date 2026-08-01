import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import {
  emailStudioGenerationPlanSchema,
  type EmailStudioGenerationPlan,
} from "./generation-plan";

export type GenerationReference = {
  url: string;
  mimeType: string;
  filename: string;
};

export type GenerationAsset = {
  id: string;
  label: string;
  url: string;
};

export type EmailStudioGenerationTelemetry = {
  responseId: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export async function generateEmailPlanWithOpenAI(input: {
  projectName: string;
  reference: GenerationReference;
  assets: GenerationAsset[];
}): Promise<{
  plan: EmailStudioGenerationPlan;
  telemetry: EmailStudioGenerationTelemetry;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OpenAI no está configurado.");
  }

  const content: ResponseInputContent[] = [
    {
      type: "input_text",
      text: [
        `Proyecto: ${input.projectName}.`,
        "Analiza el diseño aprobado y produce un plan de correo compatible.",
        "Usa solo los assetId entregados; no inventes URLs, marcas ni contenido que no aparezca en la referencia.",
        "Las piezas visuales complejas deben permanecer como imágenes. Los textos que deban personalizarse usan tokens {{variable}}.",
        "El orden de elements debe seguir el diseño de arriba hacia abajo.",
        "Si un enlace no se puede inferir, devuelve null. Las URLs finales las configurará el usuario.",
        `Assets disponibles: ${JSON.stringify(input.assets.map(({ id, label }) => ({ id, label })))}`,
      ].join("\n"),
    },
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

  for (const asset of input.assets.slice(0, 12)) {
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
      model: process.env.EMAIL_STUDIO_OPENAI_MODEL?.trim() || "gpt-5.6",
      instructions:
        "Eres especialista en HTML email. Diseñas una estructura fiel pero priorizas compatibilidad con Gmail, Apple Mail y Outlook. Devuelve exclusivamente el plan estructurado solicitado.",
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
