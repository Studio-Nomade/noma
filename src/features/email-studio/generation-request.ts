import { z } from "zod";
import {
  emailStudioGenerationPlanSchema,
  type EmailStudioGenerationPlan,
} from "./generation-plan";

/**
 * Piezas puras (sin red ni `server-only`) de la generación asistida:
 * el mismo prompt para ambos proveedores y el armado/lectura de la llamada a
 * la API de Anthropic. Se prueban sin credenciales.
 */

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

export type GenerationInput = {
  projectName: string;
  reference: GenerationReference;
  assets: GenerationAsset[];
};

/** Máximo de assets que se envían al modelo en una generación. */
export const MAX_GENERATION_ASSETS = 12;

export const EMAIL_PLAN_INSTRUCTIONS =
  "Eres especialista en HTML email. Diseñas una estructura fiel pero priorizas compatibilidad con Gmail, Apple Mail y Outlook. Devuelve exclusivamente el plan estructurado solicitado.";

export function buildPlanUserText(input: GenerationInput): string {
  return [
    `Proyecto: ${input.projectName}.`,
    "Analiza el diseño aprobado y produce un plan de correo compatible.",
    "Usa solo los assetId entregados; no inventes URLs, marcas ni contenido que no aparezca en la referencia.",
    "Las piezas visuales complejas deben permanecer como imágenes. Los textos que deban personalizarse usan tokens {{variable}}.",
    "El orden de elements debe seguir el diseño de arriba hacia abajo.",
    "Si un enlace no se puede inferir, devuelve null. Las URLs finales las configurará el usuario.",
    `Assets disponibles: ${JSON.stringify(
      input.assets
        .slice(0, MAX_GENERATION_ASSETS)
        .map(({ id, label }) => ({ id, label })),
    )}`,
  ].join("\n");
}

// ── Anthropic (Messages API con una herramienta forzada) ───────────────

export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
export const EMAIL_PLAN_TOOL = "email_studio_plan";

type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "url"; url: string } }
  | { type: "document"; source: { type: "url"; url: string }; title?: string };

/** JSON Schema del plan para `input_schema` (sin `$schema`). */
export function emailPlanJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(emailStudioGenerationPlanSchema) as Record<
    string,
    unknown
  >;
  delete schema.$schema;
  return schema;
}

export function buildAnthropicPlanRequest(
  input: GenerationInput,
  model: string,
) {
  const content: AnthropicContent[] = [
    { type: "text", text: buildPlanUserText(input) },
  ];
  if (input.reference.mimeType === "application/pdf") {
    content.push({
      type: "document",
      source: { type: "url", url: input.reference.url },
      title: input.reference.filename,
    });
  } else {
    content.push({
      type: "image",
      source: { type: "url", url: input.reference.url },
    });
  }
  for (const asset of input.assets.slice(0, MAX_GENERATION_ASSETS)) {
    content.push({ type: "text", text: `Asset ${asset.id}: ${asset.label}` });
    content.push({ type: "image", source: { type: "url", url: asset.url } });
  }

  return {
    model,
    max_tokens: 4_000,
    system: EMAIL_PLAN_INSTRUCTIONS,
    tools: [
      {
        name: EMAIL_PLAN_TOOL,
        description:
          "Entrega el plan del correo: asunto, preheader, variables y elementos en orden.",
        input_schema: emailPlanJsonSchema(),
      },
    ],
    tool_choice: { type: "tool", name: EMAIL_PLAN_TOOL },
    messages: [{ role: "user", content }],
  };
}

const anthropicResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  stop_reason: z.string().nullable().optional(),
  content: z.array(
    z.looseObject({
      type: z.string(),
      name: z.string().optional(),
      input: z.unknown().optional(),
    }),
  ),
  usage: z
    .looseObject({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
    })
    .optional(),
});

/** Error HTTP del proveedor; `status` lo usa `aiFailureCode`. */
export class EmailStudioProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "EmailStudioProviderError";
  }
}

export function parseAnthropicPlanResponse(body: unknown): {
  plan: EmailStudioGenerationPlan;
  telemetry: EmailStudioGenerationTelemetry;
} {
  const response = anthropicResponseSchema.parse(body);
  const call = response.content.find(
    (block) => block.type === "tool_use" && block.name === EMAIL_PLAN_TOOL,
  );
  if (!call) {
    throw new Error("Claude no devolvió un plan utilizable.");
  }
  const plan = emailStudioGenerationPlanSchema.parse(call.input);
  const inputTokens = response.usage?.input_tokens ?? null;
  const outputTokens = response.usage?.output_tokens ?? null;
  return {
    plan,
    telemetry: {
      responseId: response.id,
      model: response.model,
      inputTokens,
      outputTokens,
      totalTokens:
        inputTokens === null && outputTokens === null
          ? null
          : (inputTokens ?? 0) + (outputTokens ?? 0),
    },
  };
}
