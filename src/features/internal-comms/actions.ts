"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { announcementReads, announcements } from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { getCurrentTeamMember } from "@/features/team/profile";
import { ANNOUNCEMENT_CATEGORIES } from "@/types/enums";

const idSchema = z.string().uuid();
const announcementSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio.").max(160),
  body: z.string().trim().min(1, "El contenido es obligatorio.").max(12000),
  category: z.enum(ANNOUNCEMENT_CATEGORIES),
  pinned: z.boolean().default(false),
  expiresAt: z.string().datetime().nullable().optional(),
  attachments: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        url: z.string().url(),
      }),
    )
    .max(10)
    .default([]),
});
export type AnnouncementInput = z.input<typeof announcementSchema>;

async function adminContext() {
  const user = await requireUser();
  const role = roleFor(user.email);
  if (!role.isAdmin && !role.isSuperAdmin)
    throw new Error("No tienes permisos para administrar publicaciones.");
  const member = await getCurrentTeamMember(user);
  if (!member) throw new Error("No se encontró tu perfil de equipo.");
  return { user, member };
}

export async function createAnnouncement(
  raw: AnnouncementInput,
): Promise<ActionResult> {
  try {
    const { user, member } = await adminContext();
    const data = announcementSchema.parse(raw);
    const [created] = await db
      .insert(announcements)
      .values({
        ...data,
        authorId: member.id,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      })
      .returning({ id: announcements.id });
    await logActivity({
      entityType: "announcement",
      entityId: created.id,
      action: "announcement_created",
      actorId: user.id,
    });
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "createAnnouncement");
  }
}

export async function updateAnnouncement(
  id: string,
  raw: AnnouncementInput,
): Promise<ActionResult> {
  try {
    const { user } = await adminContext();
    const announcementId = idSchema.parse(id);
    const data = announcementSchema.parse(raw);
    await db
      .update(announcements)
      .set({
        ...data,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(announcements.id, announcementId));
    await logActivity({
      entityType: "announcement",
      entityId: announcementId,
      action: "announcement_updated",
      actorId: user.id,
    });
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "updateAnnouncement");
  }
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  try {
    const { user } = await adminContext();
    const announcementId = idSchema.parse(id);
    await logActivity({
      entityType: "announcement",
      entityId: announcementId,
      action: "announcement_deleted",
      actorId: user.id,
    });
    await db.delete(announcements).where(eq(announcements.id, announcementId));
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "deleteAnnouncement");
  }
}

export async function markAnnouncementRead(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const member = await getCurrentTeamMember(user);
    if (!member)
      return { ok: false, error: "No se encontró tu perfil de equipo." };
    const announcementId = idSchema.parse(id);
    await db
      .insert(announcementReads)
      .values({ announcementId, teamMemberId: member.id })
      .onConflictDoUpdate({
        target: [
          announcementReads.announcementId,
          announcementReads.teamMemberId,
        ],
        set: { readAt: new Date() },
      });
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "markAnnouncementRead");
  }
}
