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

/** Interfaz intercambiable de proveedor de IA (Anthropic, OpenAI, …). */
export interface LLMProvider {
  generateProposal(input: GenerateProposalInput): Promise<ProposalSections>;
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
};

export function getLLMProvider(): LLMProvider {
  // En el futuro: seleccionar por env (AI_PROVIDER) y devolver la implementación real.
  return stubProvider;
}
