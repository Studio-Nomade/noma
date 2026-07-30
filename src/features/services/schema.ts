import { z } from "zod";
import { AREAS, CURRENCIES, SERVICE_STATUSES } from "@/types/enums";
import { SERVICE_TIERS } from "./tiers";

const optionalText = z.string().trim().optional();

const optionalMoney = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Number(v)), "Monto inválido")
  .optional();

export const serviceVariantSchema = z.object({
  tier: z.enum(SERVICE_TIERS),
  enabled: z.boolean(),
  audience: optionalText,
  focus: optionalText,
  description: optionalText,
  methodology: optionalText,
  deliverables: optionalText,
  exclusions: optionalText,
  estimatedTime: optionalText,
  priceMinAmount: optionalMoney,
  priceMaxAmount: optionalMoney,
  priceCurrency: z.enum(CURRENCIES),
});

export const serviceSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio"),
    area: z.enum(AREAS),
    subarea: optionalText,
    requirements: optionalText,
    status: z.enum(SERVICE_STATUSES),
    variants: z.array(serviceVariantSchema).length(SERVICE_TIERS.length),
  })
  .superRefine((values, context) => {
    const receivedTiers = values.variants.map((variant) => variant.tier);
    const uniqueTiers = new Set(receivedTiers);
    if (
      uniqueTiers.size !== SERVICE_TIERS.length ||
      SERVICE_TIERS.some((tier) => !uniqueTiers.has(tier))
    ) {
      context.addIssue({
        code: "custom",
        path: ["variants"],
        message: "Las variantes deben incluir cada nivel exactamente una vez.",
      });
    }
    for (const tier of ["START", "GROWTH"] as const) {
      if (!values.variants.find((variant) => variant.tier === tier)?.enabled) {
        context.addIssue({
          code: "custom",
          path: ["variants"],
          message: `${tier} es una variante obligatoria.`,
        });
      }
    }
  });

export type ServiceFormValues = z.infer<typeof serviceSchema>;
export type ServiceVariantFormValues = z.infer<typeof serviceVariantSchema>;
