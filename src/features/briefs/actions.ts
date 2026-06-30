"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { briefs, projects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import type { BriefStatus } from "@/types/enums";

export type BriefValues = {
  mainObjective?: string;
  problem?: string;
  targetAudience?: string;
  expectedOutcome?: string;
  idealDeadline?: string;
  availableMaterials?: string;
  generalComments?: string;
  specificFields: Record<string, string>;
  status: BriefStatus;
};

/** Crea o actualiza el brief de un proyecto (uno por proyecto). */
export async function saveBrief(
  projectId: string,
  values: BriefValues,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        area: projects.area,
        clientId: projects.clientId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project) return { ok: false, error: "Proyecto no encontrado." };

    const n = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);
    const data = {
      projectId,
      clientId: project.clientId,
      area: project.area,
      projectName: project.name,
      mainObjective: n(values.mainObjective),
      problem: n(values.problem),
      targetAudience: n(values.targetAudience),
      expectedOutcome: n(values.expectedOutcome),
      idealDeadline: n(values.idealDeadline),
      availableMaterials: n(values.availableMaterials),
      generalComments: n(values.generalComments),
      specificFields: values.specificFields,
      status: values.status,
    };

    const existing = await db
      .select({ id: briefs.id })
      .from(briefs)
      .where(eq(briefs.projectId, projectId))
      .limit(1);

    if (existing.length) {
      await db
        .update(briefs)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(briefs.projectId, projectId));
    } else {
      await db.insert(briefs).values({ ...data, createdBy: user.id });
    }

    revalidatePath("/briefs");
    revalidatePath(`/briefs/${projectId}`);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "saveBrief");
  }
}

export async function setBriefStatus(
  projectId: string,
  status: BriefStatus,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db
      .update(briefs)
      .set({ status, updatedAt: new Date() })
      .where(eq(briefs.projectId, projectId));
    revalidatePath("/briefs");
    revalidatePath(`/briefs/${projectId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "setBriefStatus");
  }
}
