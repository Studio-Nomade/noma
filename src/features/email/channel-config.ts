/**
 * Contrato del archivo de configuración de canales de correo
 * (`data/email-channels.json` en noma-ops). El contenido real (alias,
 * clientes, gids de Asana, dominios) es dato operativo y vive en noma-ops; en
 * este repo solo queda el contrato y un ejemplo genérico. Módulo puro.
 */

import { z } from "zod";
import { isPublicEmailDomain } from "./addresses";
import { FOLIO_PREFIX_RE } from "./folio";

/** Solo variables de webhooks de Slack: el nombre viene de un archivo editable. */
export const SLACK_WEBHOOK_ENV_RE = /^SLACK_[A-Z0-9_]{1,60}_WEBHOOK_URL$/;

/**
 * Webhook de un aviso: el del canal (variable SLACK_…_WEBHOOK_URL de su
 * configuración) o, si no está definida, el operativo general.
 */
export function resolveSlackWebhook(
  webhookEnv: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const own =
    webhookEnv && SLACK_WEBHOOK_ENV_RE.test(webhookEnv)
      ? env[webhookEnv]?.trim()
      : null;
  return own || env.SLACK_OPERATIONS_WEBHOOK_URL?.trim() || null;
}

const gid = z.string().regex(/^\d{1,32}$/, "gid de Asana inválido");

export const emailChannelConfigSchema = z
  .object({
    alias: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ message: "alias inválido" })),
    /** Opcionales: si faltan se resuelven por projects.asana_project_gid. */
    client_id: z.uuid().optional(),
    project_id: z.uuid().optional(),
    asana_project_gid: gid,
    section_strategy: z.enum(["month", "fixed"]).default("month"),
    fixed_section_gid: gid.nullable().optional(),
    month_section_template: z.string().min(1).default("{Mes} | {YYYY}"),
    default_assignee_gid: gid.nullable().optional(),
    folio_prefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        FOLIO_PREFIX_RE,
        "prefijo inválido (letra + hasta 9 letras/dígitos)",
      ),
    /** Número desde el que parte el folio (p. ej. para continuar otra numeración). */
    folio_start: z.number().int().min(1).optional(),
    allowed_sender_domains: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .transform((value) => value.replace(/^@/, ""))
          .pipe(
            z
              .string()
              .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "dominio inválido")
              .refine((value) => !isPublicEmailDomain(value), {
                message:
                  "dominio de correo público: usa client_contacts con la dirección exacta",
              }),
          ),
      )
      .default([]),
    /**
     * Copia permanente en todos los correos del hilo (confirmación, consultas,
     * entregas…), p. ej. la supervisora del cliente. Máximo 5.
     */
    always_cc: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .pipe(z.email({ message: "correo inválido" })),
      )
      .max(5)
      .default([]),
    /**
     * Remitentes exactos que el canal ignora sin pasar por IA ni avisar (p. ej.
     * un flujo de servicio al cliente que comparte dominio con el cliente).
     */
    ignored_senders: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .pipe(z.email({ message: "correo inválido" })),
      )
      .max(50)
      .default([]),
    /**
     * Variable de entorno con el webhook de Slack del canal (la URL es secreta
     * y vive en Vercel). Sin valor se usa SLACK_OPERATIONS_WEBHOOK_URL.
     */
    slack_webhook_env: z
      .string()
      .trim()
      .regex(SLACK_WEBHOOK_ENV_RE, "debe ser SLACK_…_WEBHOOK_URL")
      .nullable()
      .optional(),
    /**
     * Pauta del cliente para leer sus correos (los campos de su formulario de
     * solicitudes, sus opciones de formato…). Se entrega a la IA tal cual.
     */
    brief_guide: z.string().trim().max(4_000).nullable().optional(),
    /**
     * Campos de Asana (enum o multi-enum, por nombre) que la IA puede completar
     * con opciones de la pauta. Solo estos: nunca Estado, Prioridad ni Ticket.
     */
    ai_fields: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
    /** Marca de revisión humana: dominios aún sin confirmar con el cliente. */
    domains_to_confirm: z.boolean().default(false),
    status: z.enum(["active", "paused"]).default("active"),
  })
  .refine(
    (value) =>
      value.section_strategy !== "fixed" || Boolean(value.fixed_section_gid),
    { message: "section_strategy 'fixed' requiere fixed_section_gid" },
  );

export const emailChannelsFileSchema = z
  .object({ channels: z.array(emailChannelConfigSchema).min(1) })
  .superRefine((value, ctx) => {
    const seen = new Map<string, string>();
    for (const channel of value.channels) {
      for (const [kind, key] of [
        ["alias", channel.alias],
        ["folio_prefix", channel.folio_prefix],
      ] as const) {
        const id = `${kind}:${key}`;
        if (seen.has(id)) {
          ctx.addIssue({
            code: "custom",
            message: `${kind} duplicado: ${key}`,
          });
        }
        seen.set(id, key);
      }
    }
  });

export type EmailChannelConfig = z.infer<typeof emailChannelConfigSchema>;
