"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { briefs, briefNotes, briefVersions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { processBriefNotes } from "@/features/ai/brief-processor";
import { ensureBrief } from "./brief-helpers";
import { BRIEF_FIELDS_BY_AREA } from "./fields";
import type { Area, NoteSource } from "@/types/enums";

const n = (v?: string | null) => (v && v.trim() !== "" ? v.trim() : null);

// ── Importar notas ───────────────────────────────────────────
export async function importNotes(
  projectId: string,
  input: {
    source: NoteSource;
    rawText?: string;
    driveUrl?: string;
    fileName?: string;
    meetingId?: string;
  },
): Promise<ActionResult<{ noteId: string }>> {
  try {
    const user = await requireUser();
    const hasContent =
      n(input.rawText) || n(input.driveUrl) || n(input.fileName);
    if (!hasContent) {
      return {
        ok: false,
        error: "Pega el texto, un enlace de Drive o carga un archivo.",
      };
    }

    const brief = await ensureBrief(projectId, user.id);

    const [note] = await db
      .insert(briefNotes)
      .values({
        projectId,
        meetingId: input.meetingId || null,
        source: input.source,
        rawText: n(input.rawText),
        driveUrl: n(input.driveUrl),
        fileName: n(input.fileName),
        matchStatus: input.source === "drive" ? "auto" : "manual",
        importedBy: user.id,
        importedByEmail: user.email ?? null,
        createdBy: user.id,
      })
      .returning({ id: briefNotes.id });

    await db
      .update(briefs)
      .set({ status: "Notas importadas", updatedAt: new Date() })
      .where(eq(briefs.id, brief.id));

    await logActivity({
      entityType: "brief",
      entityId: brief.id,
      action: "notes_imported",
      actorId: user.id,
    });

    revalidatePath(`/briefs/${projectId}`);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: { noteId: note.id } };
  } catch (err) {
    return handleActionError(err, "importNotes");
  }
}

// ── Procesar notas (IA mock) ─────────────────────────────────
export async function processNotes(
  projectId: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const brief = await ensureBrief(projectId, user.id);

    // Reúne el texto de todas las notas de la oportunidad.
    const notes = await db
      .select()
      .from(briefNotes)
      .where(eq(briefNotes.projectId, projectId))
      .orderBy(desc(briefNotes.createdAt));
    const text = notes
      .map((x) => x.rawText)
      .filter(Boolean)
      .join("\n\n")
      .trim();
    if (!text) {
      return {
        ok: false,
        error:
          "No hay texto de notas para procesar. Pega texto, carga un archivo o usa “Leer desde Drive” en una nota con enlace.",
      };
    }

    const mainArea = brief.area as Area;
    const involved = (brief.involvedAreas as Area[]) ?? [];
    const x = await processBriefNotes({ text, mainArea, involvedAreas: involved });

    // Extracción → bloques del brief (todo editable después).
    const areaBlocks: Record<string, Record<string, string>> = {
      ...(brief.areaBlocks ?? {}),
    };
    for (const area of [mainArea, ...involved]) {
      const block: Record<string, string> = { ...(areaBlocks[area] ?? {}) };
      for (const f of BRIEF_FIELDS_BY_AREA[area]) {
        const answered = x.answeredByArea[area]?.find(
          (a) => a.question === f.label,
        );
        if (answered && !block[f.key]) block[f.key] = answered.answer;
      }
      areaBlocks[area] = block;
    }

    const pendingText = Object.entries(x.pendingByArea)
      .filter(([, qs]) => qs.length)
      .map(([area, qs]) => `[${area}] ${qs.join(" · ")}`)
      .join("\n");

    await db
      .update(briefs)
      .set({
        contextGeneral: x.clientContext || brief.contextGeneral,
        mainObjective: x.objectives[0] ?? brief.mainObjective,
        problem: x.coreProblem || brief.problem,
        targetAudience: x.targetAudience || brief.targetAudience,
        expectedOutcome: x.explicitNeed || brief.expectedOutcome,
        idealDeadline: x.deadlines || brief.idealDeadline,
        budgetMentioned: x.budget || brief.budgetMentioned,
        decisionMakers: x.decisionMakers || brief.decisionMakers,
        pendingInfo: pendingText || brief.pendingInfo,
        recommendedNextAction: x.nextSteps[0] ?? brief.recommendedNextAction,
        commercialRecs: x.commercialRecommendation,
        risks: x.risks.join("\n"),
        nextSteps: x.nextSteps.join("\n"),
        areaBlocks,
        aiExtraction: x as unknown as Record<string, unknown>,
        status: "Brief sugerido",
        updatedAt: new Date(),
      })
      .where(eq(briefs.id, brief.id));

    await logActivity({
      entityType: "brief",
      entityId: brief.id,
      action: `notes_processed:${x.engine}`,
      actorId: user.id,
    });

    revalidatePath(`/briefs/${projectId}`);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "processNotes");
  }
}

// ── Guardar edición del brief (bloques general + área) ───────
export type BriefContent = {
  general: Record<string, string>;
  areaBlocks: Record<string, Record<string, string>>;
  involvedAreas: Area[];
  commercialRecs?: string;
  risks?: string;
  nextSteps?: string;
};

export async function saveBriefContent(
  projectId: string,
  content: BriefContent,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const brief = await ensureBrief(projectId, user.id);
    const g = content.general;

    await db
      .update(briefs)
      .set({
        contextGeneral: n(g.contextGeneral),
        mainObjective: n(g.mainObjective),
        problem: n(g.problem),
        targetAudience: n(g.targetAudience),
        expectedOutcome: n(g.expectedOutcome),
        idealDeadline: n(g.idealDeadline),
        availableMaterials: n(g.availableMaterials),
        budgetMentioned: n(g.budgetMentioned),
        decisionMakers: n(g.decisionMakers),
        urgency: n(g.urgency),
        restrictions: n(g.restrictions),
        generalComments: n(g.generalComments),
        pendingInfo: n(g.pendingInfo),
        recommendedNextAction: n(g.recommendedNextAction),
        commercialRecs: n(content.commercialRecs),
        risks: n(content.risks),
        nextSteps: n(content.nextSteps),
        areaBlocks: content.areaBlocks,
        involvedAreas: content.involvedAreas,
        // Al editar un brief sugerido pasa a revisión.
        status:
          brief.status === "Brief sugerido" ? "Brief en revisión" : brief.status,
        updatedAt: new Date(),
      })
      .where(eq(briefs.id, brief.id));

    await logActivity({
      entityType: "brief",
      entityId: brief.id,
      action: "brief_edited",
      actorId: user.id,
    });

    revalidatePath(`/briefs/${projectId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "saveBriefContent");
  }
}

// ── Aprobar brief (validaciones + versionado) ────────────────
export async function approveBrief(
  projectId: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const [brief] = await db
      .select()
      .from(briefs)
      .where(eq(briefs.projectId, projectId))
      .limit(1);
    if (!brief) return { ok: false, error: "Aún no hay brief que aprobar." };

    // Validaciones del spec para aprobar.
    const missing: string[] = [];
    const ext = brief.aiExtraction as {
      suggestedServices?: string[];
      executiveSummary?: string;
    } | null;
    if (!n(brief.contextGeneral) && !n(ext?.executiveSummary))
      missing.push("resumen ejecutivo / contexto");
    if (!n(brief.problem) && !n(brief.expectedOutcome))
      missing.push("necesidad del cliente");
    if (!n(brief.mainObjective)) missing.push("objetivo principal");
    if (!brief.area) missing.push("área principal");
    if (!ext?.suggestedServices?.length) missing.push("servicios sugeridos");
    if (!n(brief.nextSteps)) missing.push("próximos pasos");
    if (missing.length) {
      return {
        ok: false,
        error: `Falta completar para aprobar: ${missing.join(", ")}.`,
      };
    }

    // Snapshot versionado.
    const [last] = await db
      .select({ version: briefVersions.version })
      .from(briefVersions)
      .where(eq(briefVersions.briefId, brief.id))
      .orderBy(desc(briefVersions.version))
      .limit(1);
    const version = (last?.version ?? 0) + 1;

    const [ver] = await db
      .insert(briefVersions)
      .values({
        briefId: brief.id,
        projectId,
        version,
        snapshot: brief as unknown as Record<string, unknown>,
        aiExtraction: brief.aiExtraction,
        isApproved: true,
        approvedBy: user.id,
        approvedByEmail: user.email ?? null,
        approvedAt: new Date(),
        createdBy: user.id,
      })
      .returning({ id: briefVersions.id });

    await db
      .update(briefs)
      .set({
        status: "Brief aprobado",
        approvedVersionId: ver.id,
        approvedBy: user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(briefs.id, brief.id));

    await logActivity({
      entityType: "brief",
      entityId: brief.id,
      action: `brief_approved:v${version}`,
      actorId: user.id,
    });

    revalidatePath(`/briefs/${projectId}`);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "approveBrief");
  }
}

// ── Eliminar una nota ────────────────────────────────────────
export async function deleteNote(
  noteId: string,
  projectId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db
      .delete(briefNotes)
      .where(and(eq(briefNotes.id, noteId), eq(briefNotes.projectId, projectId)));
    revalidatePath(`/briefs/${projectId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "deleteNote");
  }
}
