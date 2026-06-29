"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { proposals, proposalServices, projects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import type { ProposalStatus } from "@/types/enums";

/** Campos de texto editables de la propuesta. */
const EDITABLE_FIELDS = [
  "title",
  "context",
  "diagnosis",
  "mainObjective",
  "specificObjectives",
  "scope",
  "workStages",
  "deliverables",
  "timeline",
  "clientRequirements",
  "exclusions",
  "team",
  "commercialConditions",
  "nextAction",
] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

export async function createProposal(
  projectId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project) return { ok: false, error: "Proyecto no encontrado." };

    const [row] = await db
      .insert(proposals)
      .values({
        projectId: project.id,
        clientId: project.clientId,
        title: `Propuesta · ${project.name}`,
        createdBy: user.id,
      })
      .returning({ id: proposals.id });
    revalidatePath("/proposals");
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return handleActionError(err, "createProposal");
  }
}

export async function updateProposalField(
  id: string,
  field: EditableField,
  value: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    if (!EDITABLE_FIELDS.includes(field)) {
      return { ok: false, error: "Campo no editable." };
    }
    await db
      .update(proposals)
      .set({ [field]: value.trim() || null, updatedAt: new Date() })
      .where(eq(proposals.id, id));
    revalidatePath(`/proposals/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateProposalField");
  }
}

export async function setProposalStatus(
  id: string,
  status: ProposalStatus,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db
      .update(proposals)
      .set({ status, updatedAt: new Date() })
      .where(eq(proposals.id, id));
    revalidatePath("/proposals");
    revalidatePath(`/proposals/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "setProposalStatus");
  }
}

export async function addProposalService(
  proposalId: string,
  serviceId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(proposalServices)
      .where(eq(proposalServices.proposalId, proposalId));
    await db
      .insert(proposalServices)
      .values({ proposalId, serviceId, position: count })
      .onConflictDoNothing();
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "addProposalService");
  }
}

export async function removeProposalService(
  rowId: string,
  proposalId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db
      .delete(proposalServices)
      .where(
        and(
          eq(proposalServices.id, rowId),
          eq(proposalServices.proposalId, proposalId),
        ),
      );
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "removeProposalService");
  }
}

/** Guarda todas las secciones de la propuesta de una vez (un solo "Guardar"). */
export async function saveProposalContent(
  id: string,
  values: Partial<Record<EditableField, string>>,
): Promise<ActionResult> {
  try {
    await requireUser();
    const patch: Record<string, string | null> = {};
    for (const f of EDITABLE_FIELDS) {
      if (f in values) patch[f] = (values[f] ?? "").trim() || null;
    }
    await db
      .update(proposals)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(proposals.id, id));
    revalidatePath(`/proposals/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "saveProposalContent");
  }
}

/** Las propuestas sí se eliminan (a diferencia de clientes/proyectos). */
export async function deleteProposal(id: string): Promise<ActionResult> {
  try {
    await requireUser();
    await db.delete(proposals).where(eq(proposals.id, id));
    revalidatePath("/proposals");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "deleteProposal");
  }
}
