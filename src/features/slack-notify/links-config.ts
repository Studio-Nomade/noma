import { z } from "zod";
import { DEFAULT_EVENTS, SLACK_EVENT_KINDS } from "./format";

/**
 * Archivo de vínculos proyecto de Asana ↔ canal de Slack. El insumo real
 * (clientes, canales) vive en noma-ops: data/asana-slack-links.json.
 * Formato: scripts/asana-slack-links.example.json. Módulo puro.
 */

const eventsSchema = z
  .object(
    Object.fromEntries(
      SLACK_EVENT_KINDS.map((kind) => [kind, z.boolean().optional()]),
    ) as Record<
      (typeof SLACK_EVENT_KINDS)[number],
      z.ZodOptional<z.ZodBoolean>
    >,
  )
  .strict();

export const slackLinkSchema = z.object({
  asana_project_gid: z.string().regex(/^\d{6,32}$/),
  asana_project_name: z.string().min(2).max(200),
  slack_channel_id: z.string().regex(/^[CG][A-Z0-9]{6,}$/),
  slack_channel_name: z
    .string()
    .min(2)
    .max(80)
    .transform((name) => name.replace(/^#/, "")),
  folio_prefix: z.string().max(10).nullable().optional(),
  events: eventsSchema.optional(),
  /** false = por confirmar: entra apagado hasta aprobarlo en Noma. */
  active: z.boolean().default(true),
});

export const slackLinksFileSchema = z.object({
  links: z
    .array(slackLinkSchema)
    .min(1)
    .refine(
      (links) =>
        new Set(links.map((l) => l.asana_project_gid)).size === links.length,
      "Hay proyectos de Asana repetidos.",
    ),
});

export type SlackLinkConfig = z.infer<typeof slackLinkSchema>;

/** Eventos completos (los que no vienen toman el valor por defecto). */
export function linkEvents(config: Pick<SlackLinkConfig, "events">) {
  return { ...DEFAULT_EVENTS, ...(config.events ?? {}) };
}
