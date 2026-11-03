/**
 * Proveedor de IA de Email Studio (ADR-008).
 *
 * - `EMAIL_STUDIO_AI_PROVIDER=anthropic|openai` (default `anthropic`).
 * - `anthropic` usa `ANTHROPIC_API_KEY` y `EMAIL_STUDIO_ANTHROPIC_MODEL`
 *   (default `claude-opus-5-5`).
 * - `openai` usa `OPENAI_API_KEY` y `EMAIL_STUDIO_OPENAI_MODEL`
 *   (default `gpt-5.6`).
 *
 * Si el proveedor elegido no tiene key, Email Studio cae al armado manual
 * (ADR-004): nunca cambia de proveedor por su cuenta.
 */
export type EmailStudioAiProvider = "anthropic" | "openai";

export const DEFAULT_EMAIL_STUDIO_ANTHROPIC_MODEL = "claude-opus-5-5";
export const DEFAULT_EMAIL_STUDIO_OPENAI_MODEL = "gpt-5.6";

export type EmailStudioAiConfig = {
  provider: EmailStudioAiProvider;
  model: string;
  /** Hay key para el proveedor elegido y el valor de proveedor es válido. */
  configured: boolean;
  /** Texto para mostrar cuando no está configurado. */
  reason: string | null;
};

type Env = Record<string, string | undefined>;

const PROVIDER_LABEL: Record<EmailStudioAiProvider, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "OpenAI",
};

export function emailStudioProviderLabel(provider: EmailStudioAiProvider) {
  return PROVIDER_LABEL[provider];
}

export function resolveEmailStudioAi(
  env: Env = process.env,
): EmailStudioAiConfig {
  const raw = env.EMAIL_STUDIO_AI_PROVIDER?.trim().toLowerCase() ?? "";

  if (raw && !["anthropic", "claude", "openai"].includes(raw)) {
    return {
      provider: "anthropic",
      model:
        env.EMAIL_STUDIO_ANTHROPIC_MODEL?.trim() ||
        DEFAULT_EMAIL_STUDIO_ANTHROPIC_MODEL,
      configured: false,
      reason: `EMAIL_STUDIO_AI_PROVIDER="${raw}" no es válido (usa anthropic u openai).`,
    };
  }

  if (raw === "openai") {
    const configured = Boolean(env.OPENAI_API_KEY?.trim());
    return {
      provider: "openai",
      model:
        env.EMAIL_STUDIO_OPENAI_MODEL?.trim() ||
        DEFAULT_EMAIL_STUDIO_OPENAI_MODEL,
      configured,
      reason: configured
        ? null
        : "OpenAI no está configurado (OPENAI_API_KEY).",
    };
  }

  const configured = Boolean(env.ANTHROPIC_API_KEY?.trim());
  return {
    provider: "anthropic",
    model:
      env.EMAIL_STUDIO_ANTHROPIC_MODEL?.trim() ||
      DEFAULT_EMAIL_STUDIO_ANTHROPIC_MODEL,
    configured,
    reason: configured
      ? null
      : "Claude no está configurado (ANTHROPIC_API_KEY).",
  };
}
