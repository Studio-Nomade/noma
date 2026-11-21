import { richTextBlocks } from "@/features/services/rich-text";
import type { SlaSection } from "./generate";

/**
 * Plantillas de SLA por área y por servicio.
 *
 * Una plantilla de área define las secciones del acuerdo con variables
 * `{{clave}}`. La variable `{{servicios}}` se reemplaza por un bloque por cada
 * servicio de la propuesta, armado con `serviceBlock` y las cláusulas propias
 * del servicio. El contenido real de las plantillas vive en noma-ops y se
 * importa con `scripts/data/import_sla_templates.ts`.
 */

export type SlaTemplateVariable = {
  key: string;
  source: "noma" | "param" | "service";
  description?: string;
};

/** Variables que ya tienen campo propio en el formulario de parámetros. */
export const BASE_PARAM_KEYS = [
  "lugar",
  "rondas_cambios",
  "plazo_aprobacion_dias",
  "vigencia_meses",
  "condiciones_pago",
];

export type SlaTemplateBlock = { title: string; body: string };

export type AreaSlaTemplate = {
  name: string;
  sections: SlaSection[];
  serviceBlock: SlaTemplateBlock | null;
  variables: SlaTemplateVariable[];
};

export type SlaServiceInput = {
  serviceId: string;
  name: string;
  tierLabel: string;
  description: string | null;
  methodology: string | null;
  deliverables: string | null;
  exclusions: string | null;
  estimatedTime: string | null;
  valueLabel: string;
};

export type SlaVars = Record<string, string | number | null | undefined>;

const VARIABLE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/** Marca visible para los datos que el equipo debe completar antes de firmar. */
export function missingMarker(key: string): string {
  return `[completar: ${key}]`;
}

/** Reemplaza `{{clave}}`; las claves vacías o ausentes quedan marcadas. */
export function renderTemplate(text: string, vars: SlaVars): string {
  return text.replace(VARIABLE, (_match, rawKey: string) => {
    const key = rawKey.toLowerCase();
    const value = vars[key];
    if (value === null || value === undefined) return missingMarker(key);
    const str = String(value).trim();
    return str ? str : missingMarker(key);
  });
}

/** Claves que siguen pendientes en un texto ya renderizado. */
export function pendingKeys(sections: SlaSection[]): string[] {
  const found = new Set<string>();
  const marker = /\[completar: ([a-z0-9_]+)\]/g;
  for (const section of sections) {
    for (const match of `${section.label}\n${section.body}`.matchAll(marker)) {
      found.add(match[1]);
    }
  }
  return [...found];
}

/** Convierte texto enriquecido de Noma (o texto plano) en líneas legibles. */
export function richToPlain(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const blocks = richTextBlocks(value, "deliverables");
  if (!blocks.length) return value.trim();
  return blocks
    .map((block) => {
      const text = block.runs
        .map((run) => run.text)
        .join("")
        .trim();
      if (!text) return "";
      const indent = "  ".repeat(Math.max(0, block.level));
      if (block.kind === "bullet") return `${indent}• ${text}`;
      if (block.kind === "ordered")
        return `${indent}${block.ordinal ?? 1}. ${text}`;
      return text;
    })
    .filter(Boolean)
    .join("\n");
}

export function serviceVars(service: SlaServiceInput): SlaVars {
  return {
    servicio: service.name,
    nivel: service.tierLabel,
    descripcion: service.description,
    metodologia: richToPlain(service.methodology),
    entregables: richToPlain(service.deliverables),
    exclusiones: service.exclusions,
    plazo_estimado: service.estimatedTime,
    valor: service.valueLabel,
  };
}

const DEFAULT_SERVICE_BLOCK: SlaTemplateBlock = {
  title: "{{servicio}} · Nivel {{nivel}}",
  body:
    "Objetivo: {{descripcion}}\n\nIncluye:\n{{metodologia}}\n\n" +
    "Entregables:\n{{entregables}}\n\nPlazo estimado: {{plazo_estimado}}\n" +
    "Valor: {{valor}}\nNo incluye: {{exclusiones}}",
};

/** Un bloque de texto por servicio, con sus cláusulas propias al final. */
export function renderServiceBlock(
  service: SlaServiceInput,
  block: SlaTemplateBlock | null,
  clauses: string | null | undefined,
  vars: SlaVars,
  index: number,
): string {
  const template = block ?? DEFAULT_SERVICE_BLOCK;
  const merged = { ...vars, ...serviceVars(service) };
  const title = `3.${index + 1}. ${renderTemplate(template.title, merged)}`;
  const body = renderTemplate(template.body, merged);
  const extra = clauses?.trim() ? `\n\n${renderTemplate(clauses, merged)}` : "";
  return `${title}\n\n${body}${extra}`;
}

export function servicesList(services: SlaServiceInput[]): string {
  return services
    .map((service) => `• ${service.name} · Nivel ${service.tierLabel}`)
    .join("\n");
}

/**
 * Arma las secciones del SLA desde la plantilla del área. `clausesByService`
 * se indexa por id de servicio.
 */
export function buildSlaFromTemplate(input: {
  template: AreaSlaTemplate;
  services: SlaServiceInput[];
  clausesByService: Map<string, string | null>;
  vars: SlaVars;
}): SlaSection[] {
  const { template, services, clausesByService } = input;
  const blocks = services
    .map((service, index) =>
      renderServiceBlock(
        service,
        template.serviceBlock,
        clausesByService.get(service.serviceId),
        input.vars,
        index,
      ),
    )
    .join("\n\n");
  const vars: SlaVars = {
    ...input.vars,
    servicios: blocks,
    servicios_lista: servicesList(services),
  };
  return template.sections.map((section) => ({
    label: renderTemplate(section.label, vars),
    body: renderTemplate(section.body, vars),
  }));
}
