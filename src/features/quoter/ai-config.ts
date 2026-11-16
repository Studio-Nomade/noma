/**
 * Configuración de IA del cotizador (ADR-009). Claude por defecto.
 *
 * - `QUOTER_AI_PROVIDER`: `anthropic` (default) · `openai` · `off`.
 * - `QUOTER_BRIEF_MODEL`: lectura de notas → brief (default `claude-sonnet-5-5`).
 * - `QUOTER_DRAFT_MODEL`: borrador de propuesta (default `claude-opus-5-5`).
 * - `QUOTER_LEARNING_MODEL`: aprendizajes al enviar/cerrar (default Sonnet).
 * - `QUOTER_DRAFT_EFFORT`: effort del borrador (default `medium`).
 *
 * Nunca cambia de proveedor por su cuenta: si el elegido no tiene key, devuelve
 * null y el flujo sigue sin IA (heurística para el brief, carga manual para la
 * propuesta).
 */

export const DEFAULT_QUOTER_BRIEF_MODEL = "claude-sonnet-5-5";
export const DEFAULT_QUOTER_DRAFT_MODEL = "claude-opus-5-5";
export const DEFAULT_QUOTER_LEARNING_MODEL = "claude-sonnet-5-5";

export type QuoterTask = "brief" | "draft" | "learning";

export type QuoterAiConfig = {
  provider: "anthropic" | "openai";
  model: string;
  effort: string;
};

type Env = Record<string, string | undefined>;

export function quoterProvider(env: Env = process.env) {
  const raw = env.QUOTER_AI_PROVIDER?.trim().toLowerCase() || "anthropic";
  if (raw === "off") return null;
  if (raw === "openai") return env.OPENAI_API_KEY?.trim() ? "openai" : null;
  return env.ANTHROPIC_API_KEY?.trim() ? "anthropic" : null;
}

export function quoterAiConfig(
  task: QuoterTask,
  env: Env = process.env,
): QuoterAiConfig | null {
  const provider = quoterProvider(env);
  if (!provider) return null;
  if (provider === "openai") {
    return {
      provider,
      model: env.OPENAI_MODEL?.trim() || "gpt-5.6-sol",
      effort: "low",
    };
  }
  const model =
    task === "draft"
      ? env.QUOTER_DRAFT_MODEL?.trim() || DEFAULT_QUOTER_DRAFT_MODEL
      : task === "brief"
        ? env.QUOTER_BRIEF_MODEL?.trim() || DEFAULT_QUOTER_BRIEF_MODEL
        : env.QUOTER_LEARNING_MODEL?.trim() || DEFAULT_QUOTER_LEARNING_MODEL;
  const effort =
    task === "draft"
      ? env.QUOTER_DRAFT_EFFORT?.trim() || "medium"
      : task === "brief"
        ? env.QUOTER_BRIEF_EFFORT?.trim() || "low"
        : "low";
  return { provider, model, effort };
}
