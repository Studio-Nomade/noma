"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, resourceLinks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { projectSchema, type ProjectFormValues } from "./schema";
import type { LinkType, ProjectStatus } from "@/types/enums";

function normalize(values: ProjectFormValues) {
  const d = projectSchema.parse(values);
  const n = (v?: string) => (v && v.trim() !== "" ? v : null);
  return {
    name: d.name,
    clientId: d.clientId,
    area: d.area,
    projectType: n(d.projectType),
    description: n(d.description),
    mainObjective: n(d.mainObjective),
    startDate: n(d.startDate),
    deliveryDate: n(d.deliveryDate),
    budgetAmount: n(d.budgetAmount),
    budgetCurrency: d.budgetCurrency,
    status: d.status,
    commercialStage: d.commercialStage,
    priority: d.priority,
    responsible: n(d.responsible),
    nextAction: n(d.nextAction),
    internalNotes: n(d.internalNotes),
  };
}

export async function createProject(
  values: ProjectFormValues,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const data = normalize(values);
    const [row] = await db
      .insert(projects)
      .values({ ...data, createdBy: user.id })
      .returning({ id: projects.id });
    revalidatePath("/projects");
    revalidatePath(`/clients/${data.clientId}`);
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return handleActionError(err, "createProject");
  }
}

export async function updateProject(
  id: string,
  values: ProjectFormValues,
): Promise<ActionResult> {
  try {
    await requireUser();
    const data = normalize(values);
    await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id));
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateProject");
  }
}

export async function setProjectStatus(
  id: string,
  status: ProjectStatus,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db
      .update(projects)
      .set({ status, updatedAt: new Date() })
      .where(eq(projects.id, id));
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "setProjectStatus");
  }
}

export async function addProjectLink(
  projectId: string,
  input: { url: string; label?: string; type?: LinkType },
): Promise<ActionResult> {
  try {
    await requireUser();
    const url = input.url.trim();
    if (!url) return { ok: false, error: "La URL es obligatoria." };
    await db.insert(resourceLinks).values({
      entityType: "project",
      entityId: projectId,
      url,
      label: input.label?.trim() || null,
      type: input.type ?? "other",
    });
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "addProjectLink");
  }
}

export async function deleteProjectLink(
  linkId: string,
  projectId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db.delete(resourceLinks).where(eq(resourceLinks.id, linkId));
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "deleteProjectLink");
  }
}
