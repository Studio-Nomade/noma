/**
 * Asistente personal de Noma (spec 16-11). Módulo puro.
 *
 * - `NOMA_ASSISTANT_PILOT_EMAILS`: quiénes ven el resumen diario durante el
 *   piloto (default: Sebastián y Ana).
 * - `ASSISTANT_MODEL` / `ASSISTANT_EFFORT`: modelo del resumen (default Sonnet,
 *   effort low). Sin `ANTHROPIC_API_KEY` el resumen sale sin IA.
 */

type Env = Record<string, string | undefined>;

export const DEFAULT_ASSISTANT_MODEL = "claude-sonnet-5-5";
export const BRIEFING_TTL_DAYS = 7;
export const STUDIO_TIME_ZONE = "America/Santiago";

export function assistantPilotEmails(env: Env = process.env): string[] {
  return (
    env.NOMA_ASSISTANT_PILOT_EMAILS ??
    "sebastian@studionomade.cl,ana@studionomade.cl"
  )
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAssistantPilot(
  email: string | null | undefined,
  env: Env = process.env,
): boolean {
  return (
    Boolean(email) && assistantPilotEmails(env).includes(email!.toLowerCase())
  );
}

export function assistantAiConfig(env: Env = process.env) {
  if (!env.ANTHROPIC_API_KEY?.trim()) return null;
  return {
    model: env.ASSISTANT_MODEL?.trim() || DEFAULT_ASSISTANT_MODEL,
    effort: env.ASSISTANT_EFFORT?.trim() || "low",
  };
}

/** Fecha YYYY-MM-DD en la zona horaria del estudio. */
export function studioDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDIO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Suma días a una fecha YYYY-MM-DD (calendario, sin zona). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}
