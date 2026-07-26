import { z } from "zod";
import { AREAS, CURRENCIES, SERVICE_STATUSES } from "@/types/enums";

const optionalText = z.string().trim().optional();

const optionalMoney = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Number(v)), "Monto inválido")
  .optional();

// Entregable estructurado: título obligatorio, descripción opcional. Las filas
// vacías (sin título) se descartan al guardar.
export const deliverableItemSchema = z.object({
  title: z.string().trim(),
  description: z.string().trim().optional(),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  area: z.enum(AREAS),
  subarea: optionalText,
  description: optionalText,
  deliverables: optionalText,
  deliverableItems: z.array(deliverableItemSchema).optional(),
  estimatedTime: optionalText,
  priceMinAmount: optionalMoney,
  priceMaxAmount: optionalMoney,
  priceCurrency: z.enum(CURRENCIES),
  requirements: optionalText,
  status: z.enum(SERVICE_STATUSES),
});

export type ServiceFormValues = z.infer<typeof serviceSchema>;
