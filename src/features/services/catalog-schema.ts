import { z } from "zod";
import { AREAS, SERVICE_STATUSES } from "@/types/enums";
import { SERVICE_TIERS } from "./tiers";

export const subareaSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  area: z.enum(AREAS),
  description: z.string().trim().optional(),
});

export const deleteSubareaSchema = z.object({
  id: z.string().uuid(),
  moveToId: z.string().uuid().optional(),
});

export const packageSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  objective: z.string().trim().optional(),
  niche: z.string().trim().optional(),
  description: z.string().trim().optional(),
  status: z.enum(SERVICE_STATUSES),
  suggestedByAi: z.boolean().default(false),
  items: z
    .array(
      z.object({
        serviceId: z.string().uuid(),
        variantTier: z.enum(SERVICE_TIERS),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1, "Selecciona al menos un servicio."),
});

export type SubareaFormValues = z.infer<typeof subareaSchema>;
export type ServicePackageFormValues = z.infer<typeof packageSchema>;

