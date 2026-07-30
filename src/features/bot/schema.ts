import { z } from "zod";

export const entityIdSchema = z.string().uuid("Identificador inválido.");

export const e164PhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^\+[1-9]\d{7,14}$/,
        "Ingresa un teléfono en formato E.164, por ejemplo +56912345678.",
      ),
  );

export const authorizedSenderSchema = z.object({
  phone: e164PhoneSchema,
  displayName: z.string().trim().min(2, "Ingresa el nombre del remitente."),
  profile: z.string().trim().min(2, "Ingresa el perfil del remitente."),
  clientContactId: entityIdSchema.optional().or(z.literal("")),
});

export type AuthorizedSenderInput = z.input<typeof authorizedSenderSchema>;
