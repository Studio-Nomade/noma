import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i);

export const emailStudioGenerationPlanSchema = z.object({
  subject: z.string().min(1).max(180),
  previewText: z.string().max(240),
  variables: z.array(
    z.object({
      key: z
        .string()
        .regex(/^[a-z0-9][a-z0-9_-]*$/)
        .max(60),
      label: z.string().min(1).max(120),
      sample: z.string().max(500),
      required: z.boolean(),
    }),
  ),
  elements: z.array(
    z.object({
      type: z.enum(["image", "text", "button", "spacer"]),
      label: z.string().min(1).max(120),
      assetId: z.string().nullable(),
      content: z.string().nullable(),
      href: z.string().nullable(),
      alt: z.string().nullable(),
      align: z.enum(["left", "center", "right"]),
      fontSize: z.number().int().min(10).max(48),
      color: hexColor,
      backgroundColor: hexColor,
      spacerHeight: z.number().int().min(1).max(200).nullable(),
    }),
  ),
});

export type EmailStudioGenerationPlan = z.infer<
  typeof emailStudioGenerationPlanSchema
>;
