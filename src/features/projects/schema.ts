import { z } from "zod";
import {
  AREAS,
  CURRENCIES,
  PROJECT_STATUSES,
  COMMERCIAL_STAGES,
  PRIORITIES,
} from "@/types/enums";

const optionalText = z.string().trim().optional();
const optionalMoney = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Number(v)), "Monto inválido")
  .optional();

export const projectSchema = z.object({
  name: z.string().trim().min(1, "El nombre del proyecto es obligatorio"),
  clientId: z.string().min(1, "Selecciona un cliente"),
  area: z.enum(AREAS),
  projectType: optionalText,
  description: optionalText,
  mainObjective: optionalText,
  startDate: optionalText,
  deliveryDate: optionalText,
  budgetAmount: optionalMoney,
  budgetCurrency: z.enum(CURRENCIES),
  status: z.enum(PROJECT_STATUSES),
  commercialStage: z.enum(COMMERCIAL_STAGES),
  priority: z.enum(PRIORITIES),
  responsible: optionalText,
  nextAction: optionalText,
  internalNotes: optionalText,
});

export type ProjectFormValues = z.infer<typeof projectSchema>;
