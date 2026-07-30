"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projects, retainerPeriods, retainers } from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { ensureCurrentPeriod } from "./periods";

const retainerSchema = z.object({
  projectId: z.string().uuid(),
  unit: z.enum(["deliverables", "hours"]),
  quotaPerPeriod: z.coerce.number().positive().max(100_000),
  startDate: z.string().date(),
  endDate: z.string().date().optional().or(z.literal("")),
  rolloverPolicy: z.enum(["none", "partial"]),
});

export type RetainerInput = z.input<typeof retainerSchema>;

export async function saveRetainer(
  raw: RetainerInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const input = retainerSchema.parse(raw);
    if (input.endDate && input.endDate < input.startDate) {
      return {
        ok: false,
        error: "La fecha de término no puede ser anterior al inicio.",
      };
    }
    const [project] = await db
      .select({ id: projects.id, clientId: projects.clientId })
      .from(projects)
      .where(eq(projects.id, input.projectId))
      .limit(1);
    if (!project) return { ok: false, error: "Proyecto no encontrado." };

    const [existing] = await db
      .select({ id: retainers.id, quotaPerPeriod: retainers.quotaPerPeriod })
      .from(retainers)
      .where(eq(retainers.projectId, input.projectId))
      .limit(1);
    const values = {
      unit: input.unit,
      quotaPerPeriod: input.quotaPerPeriod.toFixed(2),
      startDate: input.startDate,
      endDate: input.endDate || null,
      rolloverPolicy: input.rolloverPolicy,
      status: "active",
      updatedAt: new Date(),
    };
    const [saved] = existing
      ? await db
          .update(retainers)
          .set(values)
          .where(eq(retainers.id, existing.id))
          .returning({ id: retainers.id })
      : await db
          .insert(retainers)
          .values({
            ...values,
            projectId: project.id,
            clientId: project.clientId,
            createdBy: user.id,
          })
          .returning({ id: retainers.id });
    const period = await ensureCurrentPeriod(saved.id);
    if (existing && period) {
      // Conserva cualquier arrastre ya materializado y aplica solo la
      // diferencia entre la cuota base anterior y la nueva.
      const adjustedQuota = Math.max(
        Number(period.consumed),
        Number(period.quota) -
          Number(existing.quotaPerPeriod) +
          input.quotaPerPeriod,
      );
      await db
        .update(retainerPeriods)
        .set({
          quota: adjustedQuota.toFixed(2),
          remaining: Math.max(
            0,
            adjustedQuota - Number(period.consumed),
          ).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(retainerPeriods.id, period.id));
    }
    await logActivity({
      entityType: "retainer",
      entityId: saved.id,
      action: existing ? "retainer_updated" : "retainer_created",
      actorId: user.id,
    });
    revalidatePath(`/projects/${project.id}`);
    revalidatePath("/solicitudes");
    return { ok: true, data: saved };
  } catch (error) {
    return handleActionError(error, "saveRetainer");
  }
}

export async function setRetainerStatus(
  retainerId: string,
  status: "active" | "paused" | "ended",
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = z.string().uuid().parse(retainerId);
    const nextStatus = z.enum(["active", "paused", "ended"]).parse(status);
    const [updated] = await db
      .update(retainers)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(retainers.id, id))
      .returning({ projectId: retainers.projectId });
    if (!updated) return { ok: false, error: "Retainer no encontrado." };
    if (nextStatus === "active") await ensureCurrentPeriod(id);
    await logActivity({
      entityType: "retainer",
      entityId: id,
      action: `retainer_status:${nextStatus}`,
      actorId: user.id,
    });
    revalidatePath(`/projects/${updated.projectId}`);
    revalidatePath("/solicitudes");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "setRetainerStatus");
  }
}
