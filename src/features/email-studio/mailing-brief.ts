import { z } from "zod";
import {
  buildEmailDocument,
  type BuilderAsset,
  type BuilderElement,
} from "./document-builder";
import type { EmailDocument } from "./document";
import {
  DEFAULT_MAILING_ASSETS_BASE_URL,
  mailingAssetUrl,
  mailingFilename,
  mailingFolder,
  mailingSlug,
} from "./mailing-assets";

/**
 * Generador de mailings por brief: a partir de cliente, evento, envío y las
 * piezas (imágenes, textos, botones) arma el EmailDocument que compila
 * `compileEmailDocument`, con cada imagen apuntando a su URL final en
 * assets.studionomade.cl. Lo usa `npm run email-studio:brief` (chats de
 * Claude, etapa 1) y es la base de la ventana conversacional (etapa 2).
 */

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i);
const align = z.enum(["left", "center", "right"]).default("center");
const href = z
  .string()
  .refine(
    (value) =>
      /^\{\{[a-z0-9_-]+\}\}$/i.test(value) ||
      /^(https:|mailto:|tel:)/i.test(value),
    "Los enlaces deben ser https:, mailto:, tel: o una variable {{clave}}.",
  );

const blockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("image"),
    file: z.string().min(1),
    alt: z.string().min(1, "Cada imagen necesita texto alternativo."),
    href: href.optional(),
    width: z.number().int().min(1).max(1200).optional(),
    align,
  }),
  z.object({
    type: z.literal("text"),
    content: z.string().min(1),
    fontSize: z.number().int().min(10).max(48).default(16),
    color: hexColor.optional(),
    href: href.optional(),
    align,
  }),
  z.object({
    type: z.literal("button"),
    label: z.string().min(1),
    href,
    backgroundColor: hexColor.default("#1d1d1b"),
    color: hexColor.default("#ffffff"),
    align,
  }),
  z.object({
    type: z.literal("spacer"),
    height: z.number().int().min(1).max(200),
  }),
]);

export const mailingBriefSchema = z.object({
  client: z.string().min(1),
  event: z.object({
    name: z.string().min(1),
    date: z.string().min(8),
  }),
  send: z.object({
    number: z.number().int().min(1).max(99),
    date: z.string().min(8),
    name: z.string().min(1),
  }),
  subject: z.string().min(1).max(180),
  preheader: z.string().max(240).default(""),
  width: z.number().int().min(320).max(800).default(600),
  canvasColor: hexColor.default("#ffffff"),
  bodyColor: hexColor.default("#ffffff"),
  textColor: hexColor.default("#1d1d1b"),
  assetsBaseUrl: z.url().default(DEFAULT_MAILING_ASSETS_BASE_URL),
  variables: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
        label: z.string().min(1),
        sample: z.string().default(""),
        required: z.boolean().default(true),
        /** Campo de emBlue; por defecto la clave en mayúsculas. */
        emblueField: z
          .string()
          .regex(/^[A-Z0-9_]+$/)
          .optional(),
      }),
    )
    .default([]),
  blocks: z.array(blockSchema).min(1),
});

export type MailingBrief = z.input<typeof mailingBriefSchema>;
export type ParsedMailingBrief = z.output<typeof mailingBriefSchema>;

export type MailingAssetPlan = {
  /** Archivo tal como viene en el brief (ruta local o nombre). */
  source: string;
  /** Nombre publicable dentro de la carpeta del envío. */
  filename: string;
  /** Ruta dentro del repo/bucket de assets. */
  path: string;
  url: string;
};

export type MailingFromBrief = {
  brief: ParsedMailingBrief;
  folder: string;
  assets: MailingAssetPlan[];
  document: EmailDocument;
  warnings: string[];
};

export const MAX_SUBJECT_LENGTH = 100;
export const MAX_PREHEADER_LENGTH = 100;

export function subjectWarnings(subject: string, preheader: string): string[] {
  const warnings: string[] = [];
  if (subject.length > MAX_SUBJECT_LENGTH) {
    warnings.push(
      `El asunto tiene ${subject.length} caracteres; conviene que tenga hasta ${MAX_SUBJECT_LENGTH}.`,
    );
  }
  if (preheader.length > MAX_PREHEADER_LENGTH) {
    warnings.push(
      `El preheader tiene ${preheader.length} caracteres; conviene que tenga hasta ${MAX_PREHEADER_LENGTH}.`,
    );
  }
  if (!preheader) warnings.push("Falta el preheader: se usará el asunto.");
  return warnings;
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function buildMailingFromBrief(input: MailingBrief): MailingFromBrief {
  const brief = mailingBriefSchema.parse(input);
  const folder = mailingFolder(brief);

  const assets: MailingAssetPlan[] = [];
  const byFile = new Map<string, MailingAssetPlan>();
  for (const block of brief.blocks) {
    if (block.type !== "image" || byFile.has(block.file)) continue;
    const filename = mailingFilename(basename(block.file));
    if (assets.some((asset) => asset.filename === filename)) {
      throw new Error(
        `Dos piezas distintas quedan con el mismo nombre "${filename}". Renombra una.`,
      );
    }
    const plan = {
      source: block.file,
      filename,
      path: `${folder}/${filename}`,
      url: mailingAssetUrl(folder, filename, brief.assetsBaseUrl),
    };
    assets.push(plan);
    byFile.set(block.file, plan);
  }

  const builderAssets: BuilderAsset[] = [];
  const elements: BuilderElement[] = brief.blocks.map((block, index) => {
    const id = `b${String(index + 1).padStart(2, "0")}`;
    const base = {
      id,
      type: block.type,
      assetId: null,
      label: `${block.type} ${index + 1}`,
      content: null,
      href: null,
      alt: "",
      align: "center",
      fontSize: 16,
      color: brief.textColor,
      backgroundColor: brief.bodyColor,
      padding: "",
    } satisfies BuilderElement;
    switch (block.type) {
      case "image": {
        const plan = byFile.get(block.file)!;
        const assetId = mailingSlug(plan.filename);
        if (!builderAssets.some((asset) => asset.id === assetId)) {
          builderAssets.push({
            id: assetId,
            label: plan.filename,
            publicUrl: plan.url,
            width: block.width ?? brief.width,
          });
        }
        return {
          ...base,
          assetId,
          label: plan.filename,
          alt: block.alt,
          href: block.href ?? null,
          align: block.align,
          padding: "0px",
        };
      }
      case "text":
        return {
          ...base,
          content: block.content,
          fontSize: block.fontSize,
          color: block.color ?? brief.textColor,
          href: block.href ?? null,
          align: block.align,
        };
      case "button":
        return {
          ...base,
          content: block.label,
          href: block.href,
          color: block.color,
          backgroundColor: block.backgroundColor,
          align: block.align,
        };
      case "spacer":
        return { ...base, content: String(block.height) };
    }
  });

  const document = buildEmailDocument({
    project: {
      id: `${folder}`,
      name: `${brief.client} · ${brief.event.name} · ${brief.send.name}`,
      subject: brief.subject,
      previewText: brief.preheader,
      emailWidth: brief.width,
      canvasColor: brief.canvasColor,
      bodyColor: brief.bodyColor,
      textColor: brief.textColor,
    },
    assets: builderAssets,
    elements,
    variables: brief.variables.map(({ key, label, sample, required }) => ({
      key,
      label,
      sample,
      required,
    })),
  });

  return {
    brief,
    folder,
    assets,
    document,
    warnings: subjectWarnings(brief.subject, brief.preheader),
  };
}

/**
 * Convierte las variables `{{clave}}` al formato de emBlue `${{CAMPO}}`.
 * Si una clave no tiene campo declarado se usa la clave en mayúsculas.
 */
export function toEmblueHtml(
  html: string,
  fields: Record<string, string | undefined> = {},
): string {
  return html.replace(
    /\{\{\s*([a-z0-9][a-z0-9_-]*)\s*\}\}/gi,
    (_, key: string) => {
      const field = fields[key] ?? key.toUpperCase().replace(/-/g, "_");
      return `\${{${field}}}`;
    },
  );
}
