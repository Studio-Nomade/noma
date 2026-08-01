import { z } from "zod";

const optionalUuid = z
  .union([
    z.string().uuid("El proyecto vinculado no es válido."),
    z.literal(""),
  ])
  .optional();

export const emailStudioProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe un nombre de al menos 2 caracteres.")
    .max(100, "El nombre no puede superar los 100 caracteres."),
  clientId: z.string().uuid("Selecciona un cliente."),
  nomaProjectId: optionalUuid,
  description: z
    .string()
    .trim()
    .max(500, "La descripción no puede superar los 500 caracteres.")
    .optional(),
});

export type EmailStudioProjectInput = z.infer<typeof emailStudioProjectSchema>;

export function normalizeEmailStudioProjectInput(
  values: EmailStudioProjectInput,
) {
  const data = emailStudioProjectSchema.parse(values);
  return {
    name: data.name,
    clientId: data.clientId,
    nomaProjectId: data.nomaProjectId || null,
    description: data.description || null,
  };
}

export const emailStudioProjectIdSchema = z
  .string()
  .uuid("El proyecto de correo no es válido.");

export const emailStudioProjectStatusSchema = z.enum(["active", "archived"]);

export type EmailStudioProjectStatus = z.infer<
  typeof emailStudioProjectStatusSchema
>;
