import { timingSafeEqual } from "node:crypto";

/**
 * Crons de Vercel (vercel.json) y la bandera que los enciende.
 *
 * Todos parten APAGADOS: al liberar `/api/cron/*` del middleware, cualquier
 * cron que Vercel dispare empezaría a escribir en la base y a escribir a
 * clientes. Cada uno se enciende por separado, después de revisarlo, con su
 * variable en `true` (también se acepta `1` u `on`).
 *
 * - `whatsapp-drain`: procesa la cola de mensajes entrantes de WhatsApp
 *   (incluidos fallidos): crea solicitudes y tareas en Asana, consume horas de
 *   bolsa y responde por WhatsApp al remitente (confirmación o aviso de número
 *   no autorizado).
 * - `retainers-open`: el día 1 abre el período del mes de cada bolsa activa
 *   (aplica el arrastre de horas según la política de la bolsa).
 * - `email-maintenance`: renueva el watch de Gmail, recupera correos perdidos,
 *   procesa la cola del canal correo (crea tareas y responde al cliente),
 *   marca entregas trabadas y reconcilia comentarios «ENTREGA NN» de Asana
 *   (puede enviar la entrega al cliente).
 */
export const CRON_JOBS = {
  "whatsapp-drain": "CRON_WHATSAPP_DRAIN_ENABLED",
  "retainers-open": "CRON_RETAINERS_OPEN_ENABLED",
  "email-maintenance": "CRON_EMAIL_MAINTENANCE_ENABLED",
} as const;

export type CronJob = keyof typeof CRON_JOBS;

type Env = Record<string, string | undefined>;

/** ¿Está encendido este cron? Por defecto, no. */
export function isCronEnabled(job: CronJob, env: Env = process.env): boolean {
  const value = env[CRON_JOBS[job]]?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "on";
}

function safeEqual(a: string | null, b: string) {
  if (!a) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export type CronGate =
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Autoriza una llamada de Vercel Cron:
 * - sin `CRON_SECRET` → 503 (cron no configurado);
 * - `Authorization` distinto de `Bearer CRON_SECRET` → 401;
 * - cron apagado → 200 con `skipped` (Vercel no lo marca como fallo).
 *
 * La credencial se valida antes que la bandera: un llamado sin secreto nunca
 * sabe si el cron está encendido.
 */
export function gateCronRequest(
  request: Request,
  job: CronJob,
  env: Env = process.env,
): CronGate {
  const secret = env.CRON_SECRET?.trim();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      body: { ok: false, error: "Cron no configurado." },
    };
  }
  if (!safeEqual(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return { ok: false, status: 401, body: { ok: false } };
  }
  if (!isCronEnabled(job, env)) {
    return {
      ok: false,
      status: 200,
      body: {
        ok: true,
        skipped: `Cron apagado: define ${CRON_JOBS[job]}=true para encenderlo.`,
      },
    };
  }
  return { ok: true };
}
