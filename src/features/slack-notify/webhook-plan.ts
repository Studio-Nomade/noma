/**
 * Qué hacer con el webhook de Asana de cada proyecto vinculado a Slack.
 * Módulo puro: la decisión se prueba sin Asana ni base.
 */

export type WebhookAction =
  /** Vivo y registrado: nada que hacer. */
  | "ok"
  /** Vínculo activo sin webhook vivo: registrar (o recrear). */
  | "register"
  /** Vínculo apagado: borrar el webhook (si no lo usa el flujo de correo). */
  | "remove"
  /** Vínculo apagado sin webhook, o webhook que usa el flujo de correo. */
  | "keep";

export function planWebhook(input: {
  linkActive: boolean;
  /** El proyecto es de un canal de correo (Grado 360, Equifax…). */
  emailProject: boolean;
  /** Fila de asana_webhooks (null si nunca se registró). */
  row: { status: string; webhookGid: string | null } | null;
  /** ¿Asana lo reporta activo? null si no se consultó o no existe. */
  asanaActive: boolean | null;
}): WebhookAction {
  const registered = input.row?.status === "active" && !!input.row.webhookGid;
  if (!input.linkActive) {
    if (input.emailProject) return "keep";
    return registered ? "remove" : "keep";
  }
  if (registered && input.asanaActive === true) return "ok";
  return "register";
}

/** URL a la que Asana envía los eventos del proyecto. */
export function webhookTarget(baseUrl: string, projectGid: string) {
  return `${baseUrl.replace(/\/+$/, "")}/api/webhooks/asana?project=${projectGid}`;
}

/** Desde cuándo reconciliar: las últimas `hours` h, nunca antes del vínculo. */
export function reconcileSince(
  now: Date,
  linkCreatedAt: Date,
  hours = 24,
): Date {
  const window = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return window > linkCreatedAt ? window : linkCreatedAt;
}
