"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { proposals, proposalServices, projects, briefs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";

const join = (...xs: (string | null | undefined)[]) =>
  xs.filter((x) => x && x.trim()).join("\n\n") || null;

/**
 * Crea una propuesta heredando el contenido del brief aprobado de la
 * oportunidad. Adjunta los servicios seleccionados y avanza la etapa comercial.
 */
export async function createProposalFromBrief(
  projectId: string,
  input: { title?: string; serviceIds: string[] },
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();

    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
        area: projects.area,
        responsible: projects.responsible,
        responsibleId: projects.responsibleId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project) return { ok: false, error: "Oportunidad no encontrada." };

    const [brief] = await db
      .select()
      .from(briefs)
      .where(eq(briefs.projectId, projectId))
      .limit(1);

    // Validaciones del spec para crear propuesta desde brief.
    if (!brief || brief.status !== "Brief aprobado") {
      return { ok: false, error: "El brief debe estar aprobado." };
    }
    if (!project.clientId)
      return { ok: false, error: "Falta el cliente asociado." };
    if (!project.area) return { ok: false, error: "Falta el área principal." };
    if (input.serviceIds.length === 0) {
      return {
        ok: false,
        error: "Selecciona al menos un servicio para la propuesta.",
      };
    }
    if (!project.responsible && !project.responsibleId) {
      return {
        ok: false,
        error: "Define un responsable comercial en la oportunidad.",
      };
    }

    const ext = brief.aiExtraction as {
      objectives?: string[];
      suggestedServices?: string[];
    } | null;

    const [row] = await db
      .insert(proposals)
      .values({
        projectId: project.id,
        clientId: project.clientId,
        title: input.title?.trim() || `Propuesta · ${project.name}`,
        context: join(brief.contextGeneral, brief.generalComments),
        diagnosis: brief.problem,
        mainObjective: brief.mainObjective,
        specificObjectives: ext?.objectives?.length
          ? ext.objectives.map((o) => `• ${o}`).join("\n")
          : brief.expectedOutcome,
        scope: join(brief.expectedOutcome, brief.targetAudience),
        clientRequirements: join(brief.availableMaterials, brief.pendingInfo),
        timeline: brief.idealDeadline,
        exclusions: brief.risks,
        commercialConditions: brief.commercialRecs,
        nextAction: brief.recommendedNextAction,
        createdBy: user.id,
      })
      .returning({ id: proposals.id });

    // v1 es su propia raíz.
    await db
      .update(proposals)
      .set({ rootId: row.id })
      .where(eq(proposals.id, row.id));

    // Adjunta servicios seleccionados.
    if (input.serviceIds.length) {
      await db.insert(proposalServices).values(
        input.serviceIds.map((serviceId, i) => ({
          proposalId: row.id,
          serviceId,
          position: i,
        })),
      );
    }

    // Avanza la etapa comercial.
    await db
      .update(projects)
      .set({ commercialStage: "Propuesta", updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    await logActivity({
      entityType: "proposal",
      entityId: row.id,
      action: "proposal_created_from_brief",
      actorId: user.id,
    });

    revalidatePath("/proposals");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/briefs/${projectId}`);
    revalidatePath("/pipeline");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return handleActionError(err, "createProposalFromBrief");
  }
}
