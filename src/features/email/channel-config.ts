/**
 * Contrato del archivo de configuración de canales de correo
 * (`data/email-channels.json` en noma-ops). El contenido real (alias,
 * clientes, gids de Asana, dominios) es dato operativo y vive en noma-ops; en
 * este repo solo queda el contrato y un ejemplo genérico. Módulo puro.
 */

import { z } from "zod";
import { FOLIO_PREFIX_RE } from "./folio";

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
            z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "dominio inválido"),
          ),
      )
      .default([]),
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
