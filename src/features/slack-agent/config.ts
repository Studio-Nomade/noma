/**
 * Configuración de Noma en Slack (conversación por mensaje directo y
 * solicitudes CFO). Puro: valores por defecto con override por entorno.
 */
type Env = Record<string, string | undefined>;

/** Quiénes pueden conversar con Noma (por ahora Sebastián y Ana). */
export function slackAgentEmails(env: Env = process.env): string[] {
  const raw =
    env.NOMA_SLACK_AGENT_EMAILS ??
    "sebastian@studionomade.cl,ana@studionomade.cl";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Canal donde «[SOLICITUD]» crea una tarea en CFO (#general-finanzas). */
export function cfoRequestChannel(env: Env = process.env): string {
  return env.NOMA_SLACK_CFO_CHANNEL?.trim() || "C079W0GLAEL";
}

export function cfoProjectGid(env: Env = process.env): string {
  return env.NOMA_CFO_PROJECT_GID?.trim() || "1212887702303256";
}

export function cfoRequestSection(env: Env = process.env): string {
  return (
    env.NOMA_CFO_REQUEST_SECTION?.trim() || "2. Pagos y Compromisos Activos"
  );
}

export function slackAgentModel(env: Env = process.env): string {
  return env.NOMA_SLACK_AGENT_MODEL?.trim() || "claude-sonnet-5-5";
}

/** ¿El mensaje es una solicitud CFO? «[SOLICITUD]» al inicio (sin importar mayúsculas). */
export function isCfoRequest(text: string): boolean {
  return /^\s*\[\s*solicitud\s*\]/i.test(text);
}

/** Quita las menciones y el formato de enlaces de Slack para el modelo. */
export function cleanSlackText(text: string): string {
  return text
    .replace(/<@[A-Z0-9]+>/g, "")
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<(https?:[^>]+)>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}
