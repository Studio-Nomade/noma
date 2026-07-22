"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { courseEnrollments, courses } from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { getCurrentTeamMember } from "@/features/team/profile";
import {
  AREAS,
  COURSE_ENROLLMENT_STATUSES,
  COURSE_LEVELS,
  COURSE_PROVIDERS,
} from "@/types/enums";

const idSchema = z.string().uuid();
const courseSchema = z.object({
  title: z.string().trim().min(1).max(240),
  provider: z.enum(COURSE_PROVIDERS),
  url: z.string().url(),
  area: z.enum(AREAS).nullable().optional(),
  level: z.enum(COURSE_LEVELS),
  durationMin: z.number().int().positive().nullable().optional(),
  description: z.string().trim().max(5000).optional(),
  thumbnailUrl: z.union([z.literal(""), z.string().url()]).optional(),
  tags: z.array(z.string().trim().min(1)).max(20).default([]),
  active: z.boolean().default(true),
});
export type CourseInput = z.input<typeof courseSchema>;
const progressSchema = z.object({
  status: z.enum(COURSE_ENROLLMENT_STATUSES),
  progressPct: z.number().int().min(0).max(100),
  certificateUrl: z.union([z.literal(""), z.string().url()]).optional(),
  notes: z.string().trim().max(3000).optional(),
});
export type ProgressInput = z.input<typeof progressSchema>;

async function requireAdmin() {
  const user = await requireUser();
  const role = roleFor(user.email);
  if (!role.isAdmin && !role.isSuperAdmin) throw new Error("Forbidden");
  return user;
}
export async function createCourse(raw: CourseInput): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const data = courseSchema.parse(raw);
    const [created] = await db
      .insert(courses)
      .values({
        ...data,
        description: data.description || null,
        thumbnailUrl: data.thumbnailUrl || null,
      })
      .returning({ id: courses.id });
    await logActivity({
      entityType: "course",
      entityId: created.id,
      action: "course_created",
      actorId: user.id,
    });
    revalidatePath("/training");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "createCourse");
  }
}
export async function updateCourse(
  id: string,
  raw: CourseInput,
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const courseId = idSchema.parse(id);
    const data = courseSchema.parse(raw);
    await db
      .update(courses)
      .set({
        ...data,
        description: data.description || null,
        thumbnailUrl: data.thumbnailUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, courseId));
    await logActivity({
      entityType: "course",
      entityId: courseId,
      action: "course_updated",
      actorId: user.id,
    });
    revalidatePath("/training");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "updateCourse");
  }
}
export async function deleteCourse(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const courseId = idSchema.parse(id);
    await logActivity({
      entityType: "course",
      entityId: courseId,
      action: "course_deleted",
      actorId: user.id,
    });
    await db.delete(courses).where(eq(courses.id, courseId));
    revalidatePath("/training");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "deleteCourse");
  }
}
export async function assignCourse(
  courseIdRaw: string,
  memberIdsRaw: string[],
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const courseId = idSchema.parse(courseIdRaw);
    const memberIds = z.array(idSchema).min(1).parse(memberIdsRaw);
    await db
      .insert(courseEnrollments)
      .values(
        memberIds.map((teamMemberId) => ({
          courseId,
          teamMemberId,
          assignedBy: user.id,
        })),
      )
      .onConflictDoNothing();
    await logActivity({
      entityType: "course",
      entityId: courseId,
      action: `course_assigned:${memberIds.length}`,
      actorId: user.id,
    });
    revalidatePath("/training");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "assignCourse");
  }
}
export async function updateMyProgress(
  enrollmentIdRaw: string,
  raw: ProgressInput,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const member = await getCurrentTeamMember(user);
    if (!member) throw new Error("Missing member");
    const enrollmentId = idSchema.parse(enrollmentIdRaw);
    const data = progressSchema.parse(raw);
    const [enrollment] = await db
      .select({
        teamMemberId: courseEnrollments.teamMemberId,
        startedAt: courseEnrollments.startedAt,
        completedAt: courseEnrollments.completedAt,
      })
      .from(courseEnrollments)
      .where(eq(courseEnrollments.id, enrollmentId))
      .limit(1);
    if (!enrollment || enrollment.teamMemberId !== member.id)
      throw new Error("Forbidden enrollment update");
    const now = new Date();
    await db
      .update(courseEnrollments)
      .set({
        ...data,
        certificateUrl: data.certificateUrl || null,
        notes: data.notes || null,
        startedAt:
          data.status !== "asignado"
            ? (enrollment.startedAt ?? now)
            : enrollment.startedAt,
        completedAt:
          data.status === "completado" ? (enrollment.completedAt ?? now) : null,
        progressPct: data.status === "completado" ? 100 : data.progressPct,
        updatedAt: now,
      })
      .where(eq(courseEnrollments.id, enrollmentId));
    await logActivity({
      entityType: "course_enrollment",
      entityId: enrollmentId,
      action: `progress_updated:${data.status}`,
      actorId: user.id,
    });
    revalidatePath("/training");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "updateMyProgress");
  }
}
