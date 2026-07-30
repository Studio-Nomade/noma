import "server-only";

import OpenAI from "openai";
import type {
  ResponseInput,
  ResponseOutputItem,
  Tool,
} from "openai/resources/responses/responses";
import type { ProposalSection } from "@/types/enums";

/** Contrato de entrada para generar una propuesta (contexto del proyecto). */
export interface GenerateProposalInput {
  client: { companyName: string; industry?: string | null };
  project: { name: string; area: string; mainObjective?: string | null };
  brief?: Record<string, unknown> | null;
  services: { name: string; deliverables?: string | null }[];
}

/** Salida: las 12 secciones de la propuesta. */
export type ProposalSections = Record<ProposalSection, string>;

export type GenerateAgentResponseInput = {
  instructions: string;
  input: ResponseInput;
  tools: Tool[];
};

export type GenerateAgentResponseResult = {
  output: ResponseOutputItem[];
  outputText: string;
};

/** Interfaz intercambiable de proveedor de IA (Anthropic, OpenAI, …). */
export interface LLMProvider {
  generateProposal(input: GenerateProposalInput): Promise<ProposalSections>;
  generateAgentResponse(
    input: GenerateAgentResponseInput,
  ): Promise<GenerateAgentResponseResult>;
}

/**
 * Stub para V1: la arquitectura está lista pero la generación no está activa.
 * En una fase futura se implementa con Anthropic Claude (server-side). Ver
 * docs/decisions/ADR-004-ai-provider.md.
 */
export const stubProvider: LLMProvider = {
  async generateProposal() {
    throw new Error(
      "La generación con IA no está habilitada en esta versión (ver ADR-004).",
    );
  },
  async generateAgentResponse() {
    throw new Error(
      "El agente no está disponible porque OPENAI_API_KEY no está configurada.",
    );
  },
};

const openAIProvider: LLMProvider = {
  async generateProposal() {
    throw new Error(
      "La generación de propuestas con IA aún no está habilitada.",
    );
  },
  async generateAgentResponse(input) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return stubProvider.generateAgentResponse(input);

    const client = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });
    const response = await client.responses.create(
      {
        model: process.env.OPENAI_MODEL?.trim() || "gpt-5.6-sol",
        instructions: input.instructions,
        input: input.input,
        tools: input.tools,
        parallel_tool_calls: false,
        reasoning: { effort: "low" },
        text: { verbosity: "low" },
        max_output_tokens: 1_200,
        store: false,
      },
      { signal: AbortSignal.timeout(30_000) },
    );

    if (response.status === "failed" || response.error) {
      throw new Error(
        response.error?.message ?? "OpenAI no pudo completar la respuesta.",
      );
    }
    return { output: response.output, outputText: response.output_text };
  },
};

export function getLLMProvider(): LLMProvider {
  return process.env.OPENAI_API_KEY?.trim() ? openAIProvider : stubProvider;
}
