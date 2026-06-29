import { z } from "zod";
import { CLIENT_STATUSES, FINANCIAL_STATUSES } from "@/types/enums";

const optionalText = z.string().trim().optional();

export const clientSchema = z.object({
  companyName: z.string().trim().min(1, "El nombre de empresa es obligatorio"),
  contactName: optionalText,
  contactRole: optionalText,
  email: z.union([z.literal(""), z.string().trim().email("Email inválido")]),
  phone: optionalText,
  industry: optionalText,
  website: optionalText,
  instagram: optionalText,
  linkedin: optionalText,
  status: z.enum(CLIENT_STATUSES),
  internalNotes: optionalText,
  // Datos tributarios / facturación (preparación Chipax/Nubox)
  rut: optionalText,
  legalName: optionalText,
  taxActivity: optionalText,
  taxAddress: optionalText,
  billingEmail: z.union([
    z.literal(""),
    z.string().trim().email("Email inválido"),
  ]),
  financialStatus: z.enum(FINANCIAL_STATUSES),
  billingNotes: optionalText,
});

export type ClientFormValues = z.infer<typeof clientSchema>;
