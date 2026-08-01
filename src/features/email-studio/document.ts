import { z } from "zod";

const colorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Usa un color hexadecimal de seis dígitos.");

const identifierSchema = z
  .string()
  .min(1)
  .regex(
    /^[a-z0-9][a-z0-9_-]*$/,
    "Usa minúsculas, números, guiones o guion bajo.",
  );

const paddingSchema = z
  .string()
  .regex(/^\d+px(?:\s+\d+px){0,3}$/, "El padding debe expresarse en px.");

const alignSchema = z.enum(["left", "center", "right"]);

const assetSchema = z.object({
  id: identifierSchema,
  label: z.string().min(1),
  path: z.string().refine(
    (value) =>
      /^\/[^/]/.test(value) ||
      (() => {
        try {
          return new URL(value).protocol === "https:";
        } catch {
          return false;
        }
      })(),
    "El asset debe usar una ruta raíz o una URL HTTPS.",
  ),
  alt: z.string(),
  width: z.number().int().positive(),
});

const variableSchema = z.object({
  key: identifierSchema,
  label: z.string().min(1),
  sample: z.string(),
  required: z.boolean().default(true),
});

const imageBlockSchema = z.object({
  id: identifierSchema,
  type: z.literal("image"),
  assetId: identifierSchema,
  width: z.number().int().positive(),
  padding: paddingSchema.default("0px"),
  align: alignSchema.default("center"),
  alt: z.string().max(240).optional(),
  href: z.string().min(1).optional(),
});

const eyebrowBlockSchema = z.object({
  id: identifierSchema,
  type: z.literal("eyebrow"),
  content: z.string().min(1),
  color: colorSchema,
  padding: paddingSchema.default("0px"),
  align: alignSchema.default("center"),
});

const headingBlockSchema = z.object({
  id: identifierSchema,
  type: z.literal("heading"),
  content: z.string().min(1),
  color: colorSchema,
  fontSize: z.number().int().min(18).max(72),
  lineHeight: z.number().int().min(20).max(84),
  padding: paddingSchema.default("0px"),
  align: alignSchema.default("center"),
});

const textBlockSchema = z.object({
  id: identifierSchema,
  type: z.literal("text"),
  content: z.string().min(1),
  color: colorSchema,
  fontSize: z.number().int().min(10).max(36),
  lineHeight: z.number().int().min(12).max(52),
  padding: paddingSchema.default("0px"),
  align: alignSchema.default("left"),
  href: z.string().min(1).optional(),
});

const buttonBlockSchema = z.object({
  id: identifierSchema,
  type: z.literal("button"),
  label: z.string().min(1),
  href: z.string().min(1),
  backgroundColor: colorSchema,
  color: colorSchema,
  borderRadius: z.number().int().min(0).max(32).default(6),
  padding: paddingSchema.default("0px"),
  align: alignSchema.default("center"),
});

const spacerBlockSchema = z.object({
  id: identifierSchema,
  type: z.literal("spacer"),
  height: z.number().int().min(1).max(200),
});

export const emailBlockSchema = z.discriminatedUnion("type", [
  imageBlockSchema,
  eyebrowBlockSchema,
  headingBlockSchema,
  textBlockSchema,
  buttonBlockSchema,
  spacerBlockSchema,
]);

const cardSectionSchema = z.object({
  id: identifierSchema,
  type: z.literal("card"),
  label: z.string().min(1),
  backgroundColor: colorSchema,
  backgroundAssetId: identifierSchema.optional(),
  borderRadius: z.number().int().min(0).max(40).default(18),
  outerPadding: z.number().int().min(0).max(50).default(25),
  blocks: z.array(emailBlockSchema).min(1),
});

const legalSectionSchema = z.object({
  id: identifierSchema,
  type: z.literal("legal"),
  label: z.string().min(1),
  content: z.string().min(1),
  color: colorSchema,
});

const footerLinkSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  assetId: identifierSchema,
});

const footerSectionSchema = z.object({
  id: identifierSchema,
  type: z.literal("footer"),
  label: z.string().min(1),
  logoAssetId: identifierSchema,
  logoWidth: z.number().int().positive(),
  links: z.array(footerLinkSchema).max(5),
});

export const emailSectionSchema = z.discriminatedUnion("type", [
  cardSectionSchema,
  legalSectionSchema,
  footerSectionSchema,
]);

export const emailDocumentSchema = z
  .object({
    version: z.literal("1.0"),
    id: identifierSchema,
    name: z.string().min(1),
    subject: z.string().min(1),
    previewText: z.string().min(1),
    language: z.string().min(2).max(8).default("es"),
    width: z.number().int().min(560).max(720),
    theme: z.object({
      canvasColor: colorSchema,
      topBandColor: colorSchema,
      topBandHeight: z.number().int().min(0).max(200).default(0),
      textColor: colorSchema,
      fontFamily: z.string().min(1),
    }),
    assets: z.array(assetSchema),
    variables: z.array(variableSchema),
    sections: z.array(emailSectionSchema).min(1),
  })
  .superRefine((document, context) => {
    const assetIds = new Set(document.assets.map((asset) => asset.id));
    const referencedAssets = new Set<string>();

    for (const section of document.sections) {
      if (section.type === "card") {
        if (section.backgroundAssetId) {
          referencedAssets.add(section.backgroundAssetId);
        }
        for (const block of section.blocks) {
          if (block.type === "image") referencedAssets.add(block.assetId);
        }
      }
      if (section.type === "footer") {
        referencedAssets.add(section.logoAssetId);
        for (const link of section.links) referencedAssets.add(link.assetId);
      }
    }

    for (const id of referencedAssets) {
      if (!assetIds.has(id)) {
        context.addIssue({
          code: "custom",
          message: `El blueprint referencia el asset inexistente "${id}".`,
          path: ["assets"],
        });
      }
    }

    const variableKeys = document.variables.map((variable) => variable.key);
    if (new Set(variableKeys).size !== variableKeys.length) {
      context.addIssue({
        code: "custom",
        message: "Las variables no pueden repetir su clave.",
        path: ["variables"],
      });
    }
  });

export type EmailDocument = z.infer<typeof emailDocumentSchema>;
export type EmailBlock = z.infer<typeof emailBlockSchema>;
export type EmailSection = z.infer<typeof emailSectionSchema>;
