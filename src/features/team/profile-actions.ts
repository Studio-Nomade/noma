"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { getCurrentTeamMember } from "./profile";
import { buildSignatureHtml } from "./signature";
import { AREAS } from "@/types/enums";

const profileSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  roleTitle: z.string().trim().optional(),
  area: z.enum(AREAS).nullable().optional(),
  phone: z.string().trim().optional(),
  birthDate: z.union([z.literal(""), z.string().date()]).optional(),
  photoUrl: z
    .union([z.literal(""), z.string().trim().url("URL de foto inválida")])
    .optional(),
});

export type ProfileValues = z.input<typeof profileSchema>;

/** Actualiza el perfil del usuario conectado (su propia fila de team_members). */
export async function updateMyProfile(
  raw: ProfileValues,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const member = await getCurrentTeamMember(user);
    if (!member) {
      return {
        ok: false,
        error: "No se encontró tu perfil. Cierra sesión y vuelve a entrar.",
      };
    }

    const d = profileSchema.parse(raw);
    const n = (v?: string | null) => (v && v.trim() !== "" ? v.trim() : null);

    // Firma = HTML generado con la marca del estudio (constructor guiado).
    const emailSignature = buildSignatureHtml({
      name: d.name.trim(),
      roleTitle: n(d.roleTitle),
      phone: n(d.phone),
    });

    await db
      .update(teamMembers)
      .set({
        name: d.name.trim(),
        roleTitle: n(d.roleTitle),
        area: d.area ?? null,
        phone: n(d.phone),
        birthDate: n(d.birthDate),
        photoUrl: n(d.photoUrl),
        emailSignature,
        updatedAt: new Date(),
      })
      .where(eq(teamMembers.id, member.id));

    revalidatePath("/profile");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateMyProfile");
  }
}
