"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  proposals,
  proposalServices,
  proposalTeam,
  proposalNotes,
  teamMembers,
  projects,
} from "@/db/schema";
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
    // la v1 es su propia raíz
    await db
      .update(proposals)
      .set({ rootId: row.id })
      .where(eq(proposals.id, row.id));
    revalidatePath("/proposals");
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return handleActionError(err, "createProposal");
  }
}

/** Clona la propuesta como una nueva versión (servicios + equipo + contenido). */
export async function createProposalVersion(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const [p] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, id))
      .limit(1);
    if (!p) return { ok: false, error: "Propuesta no encontrada." };
    const root = p.rootId ?? p.id;

    const [{ maxV }] = await db
      .select({ maxV: sql<number>`coalesce(max(version), 1)::int` })
      .from(proposals)
      .where(eq(proposals.rootId, root));
    const nextVersion = (maxV ?? p.version) + 1;

    const [row] = await db
      .insert(proposals)
      .values({
        projectId: p.projectId,
        clientId: p.clientId,
        title: p.title,
        context: p.context,
        diagnosis: p.diagnosis,
        mainObjective: p.mainObjective,
        specificObjectives: p.specificObjectives,
        scope: p.scope,
        workStages: p.workStages,
        deliverables: p.deliverables,
        timeline: p.timeline,
        clientRequirements: p.clientRequirements,
        exclusions: p.exclusions,
        team: p.team,
        commercialConditions: p.commercialConditions,
        nextAction: p.nextAction,
        status: "Borrador",
        version: nextVersion,
        rootId: root,
        createdBy: user.id,
      })
      .returning({ id: proposals.id });

    // copiar servicios y equipo
    const svc = await db
      .select()
      .from(proposalServices)
      .where(eq(proposalServices.proposalId, id));
    if (svc.length) {
      await db.insert(proposalServices).values(
        svc.map((s) => ({
          proposalId: row.id,
          serviceId: s.serviceId,
          position: s.position,
          customPriceAmount: s.customPriceAmount,
          customPriceCurrency: s.customPriceCurrency,
        })),
      );
    }
    const tm = await db
      .select()
      .from(proposalTeam)
      .where(eq(proposalTeam.proposalId, id));
    if (tm.length) {
      await db.insert(proposalTeam).values(
        tm.map((t) => ({
          proposalId: row.id,
          memberId: t.memberId,
          roleInProject: t.roleInProject,
          position: t.position,
        })),
      );
    }

    revalidatePath("/proposals");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return handleActionError(err, "createProposalVersion");
  }
}

export async function addProposalNote(
  rootId: string,
  body: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const text = body.trim();
    if (!text) return { ok: false, error: "El comentario está vacío." };
    await db.insert(proposalNotes).values({
      rootId,
      authorId: user.id,
      authorEmail: user.email ?? null,
      body: text,
    });
    revalidatePath("/proposals");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "addProposalNote");
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

export async function addProposalTeamMember(
  proposalId: string,
  memberId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    const [member] = await db
      .select({ roleTitle: teamMembers.roleTitle })
      .from(teamMembers)
      .where(eq(teamMembers.id, memberId))
      .limit(1);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(proposalTeam)
      .where(eq(proposalTeam.proposalId, proposalId));
    await db
      .insert(proposalTeam)
      .values({
        proposalId,
        memberId,
        roleInProject: member?.roleTitle ?? null,
        position: count,
      })
      .onConflictDoNothing();
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "addProposalTeamMember");
  }
}

export async function removeProposalTeamMember(
  rowId: string,
  proposalId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db.delete(proposalTeam).where(eq(proposalTeam.id, rowId));
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "removeProposalTeamMember");
  }
}

export async function updateProposalTeamRole(
  rowId: string,
  proposalId: string,
  roleInProject: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db
      .update(proposalTeam)
      .set({ roleInProject: roleInProject.trim() || null })
      .where(eq(proposalTeam.id, rowId));
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateProposalTeamRole");
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
