"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { devLog, devMilestones, devModules, devPrograms } from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { MILESTONE_STATUSES } from "./constants";

/** Fecha local (America/Santiago) en formato YYYY-MM-DD. */
function todayLocal() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
  }).format(new Date());
}

async function programOf(moduleId: string) {
  const [row] = await db
    .select({
      programId: devModules.programId,
      projectId: devPrograms.projectId,
      code: devModules.code,
    })
    .from(devModules)
    .innerJoin(devPrograms, eq(devPrograms.id, devModules.programId))
    .where(eq(devModules.id, moduleId))
    .limit(1);
  return row ?? null;
}

const milestoneStatusSchema = z.object({
  milestoneId: z.string().uuid(),
  status: z.enum(MILESTONE_STATUSES),
});

export async function setMilestoneStatus(
  raw: z.input<typeof milestoneStatusSchema>,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const input = milestoneStatusSchema.parse(raw);
    const [milestone] = await db
      .select({
        id: devMilestones.id,
        moduleId: devMilestones.moduleId,
        name: devMilestones.name,
        status: devMilestones.status,
      })
      .from(devMilestones)
      .where(eq(devMilestones.id, input.milestoneId))
      .limit(1);
    if (!milestone) return { ok: false, error: "Hito no encontrado." };
    if (milestone.status === input.status) return { ok: true, data: undefined };
    const ctx = await programOf(milestone.moduleId);
    if (!ctx) return { ok: false, error: "Módulo no encontrado." };

    const today = todayLocal();
    await db
      .update(devMilestones)
      .set({
        status: input.status,
        date: input.status === "en_prod" ? today : undefined,
        updatedAt: new Date(),
      })
      .where(eq(devMilestones.id, milestone.id));
    await db
      .insert(devLog)
      .values({
        programId: ctx.programId,
        date: today,
        moduleId: milestone.moduleId,
        moduleCode: ctx.code,
        text: `${milestone.name}: ${milestone.status} → ${input.status}`,
        source: "manual",
        createdBy: user.id,
      })
      .onConflictDoNothing();
    await logActivity({
      entityType: "dev_milestone",
      entityId: milestone.id,
      action: `status:${input.status}`,
      actorId: user.id,
    });
    revalidatePath(`/projects/${ctx.projectId}/seguimiento`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "dev-tracking/setMilestoneStatus");
  }
}

const ballSchema = z.object({
  moduleId: z.string().uuid(),
  ballOwner: z.string().trim().max(200).optional().or(z.literal("")),
  ballWhat: z.string().trim().max(2000).optional().or(z.literal("")),
  nextFollowUp: z.string().date().optional().or(z.literal("")),
  progress: z.coerce.number().int().min(0).max(100).optional(),
});

export async function updateModuleBall(
  raw: z.input<typeof ballSchema>,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const input = ballSchema.parse(raw);
    const ctx = await programOf(input.moduleId);
    if (!ctx) return { ok: false, error: "Módulo no encontrado." };
    await db
      .update(devModules)
      .set({
        ballOwner: input.ballOwner || null,
        ballWhat: input.ballWhat || null,
        nextFollowUp: input.nextFollowUp || null,
        ...(input.progress !== undefined ? { progress: input.progress } : {}),
        updatedAt: new Date(),
      })
      .where(eq(devModules.id, input.moduleId));
    await logActivity({
      entityType: "dev_module",
      entityId: input.moduleId,
      action: "ball_updated",
      actorId: user.id,
    });
    revalidatePath(`/projects/${ctx.projectId}/seguimiento`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "dev-tracking/updateModuleBall");
  }
}

const logSchema = z.object({
  programId: z.string().uuid(),
  moduleId: z.string().uuid().optional().or(z.literal("")),
  text: z.string().trim().min(3).max(2000),
});

export async function addLogEntry(
  raw: z.input<typeof logSchema>,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const input = logSchema.parse(raw);
    const [program] = await db
      .select({ id: devPrograms.id, projectId: devPrograms.projectId })
      .from(devPrograms)
      .where(eq(devPrograms.id, input.programId))
      .limit(1);
    if (!program) return { ok: false, error: "Programa no encontrado." };
    let moduleCode: string | null = null;
    if (input.moduleId) {
      const [mod] = await db
        .select({ code: devModules.code })
        .from(devModules)
        .where(
          and(
            eq(devModules.id, input.moduleId),
            eq(devModules.programId, program.id),
          ),
        )
        .limit(1);
      moduleCode = mod?.code ?? null;
    }
    await db
      .insert(devLog)
      .values({
        programId: program.id,
        date: todayLocal(),
        moduleId: input.moduleId || null,
        moduleCode,
        text: input.text,
        source: "manual",
        createdBy: user.id,
      })
      .onConflictDoNothing();
    revalidatePath(`/projects/${program.projectId}/seguimiento`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "dev-tracking/addLogEntry");
  }
}
