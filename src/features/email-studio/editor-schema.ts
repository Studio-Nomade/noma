import { z } from "zod";

export const emailStudioIdSchema = z.string().uuid("Identificador inválido.");

export const emailStudioHrefSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (!value) return true;
    if (/^\{\{[a-z0-9_-]+\}\}$/i.test(value)) return true;
    try {
      return ["https:", "mailto:", "tel:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Usa HTTPS, mailto:, tel: o una variable {{enlace}}.");

const colorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Usa un color hexadecimal de seis dígitos.");

export const emailStudioSettingsSchema = z.object({
  projectId: emailStudioIdSchema,
  subject: z.string().trim().min(1).max(180),
  previewText: z.string().trim().max(240),
  emailWidth: z.coerce.number().int().min(560).max(720),
  canvasColor: colorSchema,
  bodyColor: colorSchema,
  textColor: colorSchema,
});

export const emailStudioElementInputSchema = z.object({
  projectId: emailStudioIdSchema,
  id: z.union([emailStudioIdSchema, z.literal("")]).optional(),
  type: z.enum(["text", "button", "spacer"]),
  label: z.string().trim().min(1).max(120),
  content: z.string().trim().max(5_000).optional(),
  href: emailStudioHrefSchema.optional(),
  align: z.enum(["left", "center", "right"]).default("left"),
  fontSize: z.coerce.number().int().min(10).max(48).default(16),
  color: colorSchema.default("#333333"),
  backgroundColor: colorSchema.default("#111111"),
});

export const emailStudioImageElementSchema = z.object({
  projectId: emailStudioIdSchema,
  id: emailStudioIdSchema,
  label: z.string().trim().min(1).max(120),
  alt: z.string().trim().max(240),
  href: emailStudioHrefSchema.optional(),
});

export const emailStudioVariableInputSchema = z.object({
  projectId: emailStudioIdSchema,
  key: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(60)
    .regex(
      /^[a-z0-9][a-z0-9_-]*$/,
      "Usa minúsculas, números, guiones o guion bajo.",
    ),
  label: z.string().trim().min(1).max(120),
  sample: z.string().trim().max(500),
  required: z.boolean().default(true),
});

export const emailStudioTemplateInputSchema = z.object({
  projectId: emailStudioIdSchema,
  assetId: emailStudioIdSchema,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional(),
  alt: z.string().trim().max(240),
  href: emailStudioHrefSchema.optional(),
});

export const emailStudioTemplateInsertSchema = z.object({
  projectId: emailStudioIdSchema,
  templateId: emailStudioIdSchema,
});

export const emailStudioTemplateStatusSchema = z.enum(["active", "archived"]);

export type EmailStudioSettingsInput = z.infer<
  typeof emailStudioSettingsSchema
>;
export type EmailStudioElementInput = z.infer<
  typeof emailStudioElementInputSchema
>;
export type EmailStudioImageElementInput = z.infer<
  typeof emailStudioImageElementSchema
>;
export type EmailStudioVariableInput = z.infer<
  typeof emailStudioVariableInputSchema
>;
export type EmailStudioTemplateInput = z.infer<
  typeof emailStudioTemplateInputSchema
>;
