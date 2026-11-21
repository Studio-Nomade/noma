import { z } from "zod";
import { AREAS, SERVICE_STATUSES } from "@/types/enums";
import { SERVICE_TIERS } from "@/features/services/tiers";
import { serializeRichTextDocument } from "@/features/services/rich-text";

/**
 * Formato de los archivos de catálogo por área (`data/normalized/*_services_*.json`
 * en noma-ops) y de plantillas SLA (`data/normalized/*_sla_templates.json`).
 * Este módulo solo valida y transforma; no contiene datos comerciales.
 */

const money = z.number().nonnegative().nullable();

export const catalogVariantSchema = z.object({
  tier: z.enum(SERVICE_TIERS),
  enabled: z.boolean(),
  audience: z.string().optional(),
  focus: z.string().optional(),
  description: z.string().optional(),
  methodology: z.array(z.string()).optional(),
  deliverables: z.array(z.string()).optional(),
  exclusions: z.string().optional(),
  estimatedTime: z.string().optional(),
  priceMinAmount: money,
  priceMaxAmount: money,
  priceCurrency: z.enum(["UF", "CLP", "USD"]),
});

export const catalogServiceSchema = z
  .object({
    name: z.string().min(1),
    subarea: z.string().min(1),
    unit: z.string().optional(),
    status: z.enum(SERVICE_STATUSES).default("Activo"),
    description: z.string().optional(),
    requirements: z.string().optional(),
    replaces: z.string().optional(),
    variants: z.array(catalogVariantSchema).length(SERVICE_TIERS.length),
  })
  .superRefine((service, ctx) => {
    const tiers = new Set(service.variants.map((v) => v.tier));
    if (tiers.size !== SERVICE_TIERS.length) {
      ctx.addIssue({
        code: "custom",
        message: `${service.name}: cada nivel debe aparecer una vez.`,
      });
    }
    for (const tier of ["START", "GROWTH"] as const) {
      if (!service.variants.find((v) => v.tier === tier)?.enabled) {
        ctx.addIssue({
          code: "custom",
          message: `${service.name}: ${tier} es obligatorio.`,
        });
      }
    }
    for (const v of service.variants) {
      if (
        v.priceMinAmount != null &&
        v.priceMaxAmount != null &&
        v.priceMaxAmount < v.priceMinAmount
      ) {
        ctx.addIssue({
          code: "custom",
          message: `${service.name} ${v.tier}: máximo menor que mínimo.`,
        });
      }
    }
  });

export const catalogChangeSchema = z.object({
  service: z.string().min(1),
  action: z.enum(["update", "move", "keep", "deactivate"]),
  to_area: z.enum(AREAS).optional(),
  to_subarea: z.string().optional(),
  note: z.string().optional(),
});

export const catalogFileSchema = z.object({
  version: z.string(),
  area: z.enum(AREAS),
  source_file: z.string().min(1),
  services: z.array(catalogServiceSchema).min(1),
  catalog_changes: z.array(catalogChangeSchema).default([]),
});

export type CatalogFile = z.infer<typeof catalogFileSchema>;

const sectionSchema = z.object({ label: z.string(), body: z.string() });

export const slaTemplateFileSchema = z.object({
  version: z.string(),
  area: z.enum(AREAS),
  name: z.string().min(1),
  variables: z.array(
    z.object({
      key: z.string().regex(/^[a-z0-9_]+$/),
      source: z.enum(["noma", "param", "service"]),
      description: z.string().optional(),
    }),
  ),
  sections: z.array(sectionSchema).min(1),
  service_block: z.object({ title: z.string(), body: z.string() }).nullable(),
  services: z
    .array(z.object({ service: z.string().min(1), clauses: z.string() }))
    .default([]),
});

export type SlaTemplateFile = z.infer<typeof slaTemplateFileSchema>;

/** Lista de líneas → texto enriquecido de Noma (lista con viñetas). */
export function linesToRichText(lines: string[] | undefined): string | null {
  const clean = (lines ?? []).map((line) => line.trim()).filter(Boolean);
  if (!clean.length) return null;
  return serializeRichTextDocument({
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: clean.map((text) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text }] }],
        })),
      },
    ],
  });
}

/** Variables usadas en un texto que la plantilla no declara. */
export function undeclaredVariables(file: SlaTemplateFile): string[] {
  const declared = new Set([
    ...file.variables.map((v) => v.key),
    "servicios",
    "servicios_lista",
  ]);
  const texts = [
    ...file.sections.flatMap((s) => [s.label, s.body]),
    file.service_block?.title ?? "",
    file.service_block?.body ?? "",
    ...file.services.map((s) => s.clauses),
  ];
  const used = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) {
      used.add(match[1].toLowerCase());
    }
  }
  return [...used].filter((key) => !declared.has(key));
}
