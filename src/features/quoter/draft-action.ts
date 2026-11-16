"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  projects,
  proposalServices,
  proposalTeam,
  proposals,
  quoterLearnings,
  quoterRuns,
  serviceSubareas,
  serviceVariants,
  services,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { ensureServiceLedgerAccount } from "@/features/finance/plan-accounts/service-link";
import { serializeStructuredContent } from "@/features/proposals/structured-content";
import { quoterAiConfig } from "./ai-config";
import { buildDraftContext } from "./context";
import { quoterStructured } from "./llm";
import { normalizeDraft, type NormalizedDraft } from "./normalize";
import { draftSystemBlocks, draftUserInput } from "./prompt";
import { proposalDraftSchema, type ProposalDraft } from "./schema";

const inputSchema = z.object({
  projectId: z.string().uuid(),
  instructions: z.string().max(4_000).optional().nullable(),
});

export type DraftResult = {
  id: string;
  warnings: string[];
  customServices: number;
};

/**
 * Brief aprobado → propuesta en Borrador armada por Claude: servicios del
 * catálogo con nivel, cantidad y valor; servicios nuevos o ajustados creados
 * en el catálogo como "En revisión"; secciones; descuento y equipo. Todo queda
 * editable y el borrador original se guarda en `quoter_runs` para aprender de
 * lo que el equipo cambie antes de enviar.
 */
export async function generateProposalWithAi(
  projectId: string,
  options: { instructions?: string | null } = {},
): Promise<ActionResult<DraftResult>> {
  let runId: string | null = null;
  try {
    const user = await requireUser();
    if (roleFor(user.email).isReadOnly) {
      return {
        ok: false,
        error: "Tu perfil es de lectura: no puede crear propuestas.",
      };
    }
    const input = inputSchema.parse({
      projectId,
      instructions: options.instructions,
    });
    if (!quoterAiConfig("draft")) {
      return {
        ok: false,
        error:
          "La IA del cotizador no está configurada (falta ANTHROPIC_API_KEY en el entorno).",
      };
    }

    const context = await buildDraftContext(
      input.projectId,
      input.instructions,
    );
    if (context.brief.status !== "Brief aprobado") {
      return { ok: false, error: "Aprueba el brief antes de cotizar con IA." };
    }

    const [run] = await db
      .insert(quoterRuns)
      .values({
        kind: "draft",
        projectId: input.projectId,
        createdBy: user.id,
        createdByEmail: user.email ?? null,
        contextRefs: {
          catalogSize: context.catalog.entries.length,
          learningIds: context.learnings.map((l) => l.id),
          precedentIds: context.precedents.map((p) => p.id),
          instructions: input.instructions?.trim() || null,
        },
      })
      .returning({ id: quoterRuns.id });
    runId = run.id;

    const result = await quoterStructured("draft", {
      feature: "quoter_draft",
      system: draftSystemBlocks(context.prompt),
      input: draftUserInput(context.prompt),
      schema: proposalDraftSchema,
      maxTokens: 20_000,
      timeoutMs: 280_000,
    });
    const draft = result.data;
    const normalized = normalizeDraft(draft, context.catalog.refs, {
      learningIds: context.learnings.map((l) => l.id),
      precedentIds: context.precedents.map((p) => p.id),
      teamIds: context.team.map((m) => m.id),
    });
    if (!normalized.lines.length) {
      throw new Error(
        "La IA no propuso ningún servicio válido. Revisa el brief y reintenta.",
      );
    }

    const created = await persistDraft({
      projectId: input.projectId,
      clientId: context.project.clientId,
      userId: user.id,
      draft,
      normalized,
    });

    for (const serviceId of created.newServiceIds) {
      await ensureServiceLedgerAccount(serviceId).catch((error) =>
        console.error("[quoter] cuenta contable", error),
      );
    }
    if (normalized.appliedLearningIds.length) {
      await db
        .update(quoterLearnings)
        .set({
          timesApplied: sql`${quoterLearnings.timesApplied} + 1`,
          lastAppliedAt: new Date(),
        })
        .where(inArray(quoterLearnings.id, normalized.appliedLearningIds));
    }

    await db
      .update(quoterRuns)
      .set({
        status: "done",
        proposalId: created.proposalId,
        provider: result.provider,
        model: result.model,
        durationMs: result.durationMs,
        output: {
          draft,
          lines: normalized.lines.map((line, index) => ({
            ...line,
            serviceId:
              line.serviceId ??
              created.newServiceIds[created.customIndex.indexOf(index)] ??
              null,
          })),
          discount: normalized.discount,
          appliedLearningIds: normalized.appliedLearningIds,
          precedentIds: normalized.precedentIds,
          warnings: normalized.warnings,
        },
        finishedAt: new Date(),
      })
      .where(eq(quoterRuns.id, run.id));

    await logActivity({
      entityType: "proposal",
      entityId: created.proposalId,
      action: `proposal_ai_draft:${result.model}`,
      actorId: user.id,
    });

    revalidatePath("/proposals");
    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath(`/briefs/${input.projectId}`);
    revalidatePath("/pipeline");
    revalidatePath("/services");
    return {
      ok: true,
      data: {
        id: created.proposalId,
        warnings: normalized.warnings,
        customServices: created.newServiceIds.length,
      },
    };
  } catch (err) {
    if (runId) {
      await db
        .update(quoterRuns)
        .set({
          status: "failed",
          error:
            err instanceof Error
              ? err.message.slice(0, 500)
              : "Error desconocido",
          finishedAt: new Date(),
        })
        .where(eq(quoterRuns.id, runId))
        .catch(() => undefined);
    }
    return handleActionError(err, "generateProposalWithAi");
  }
}

async function persistDraft(input: {
  projectId: string;
  clientId: string;
  userId: string;
  draft: ProposalDraft;
  normalized: NormalizedDraft;
}) {
  const { draft, normalized } = input;
  const s = draft.sections;
  const text = (value: string) => (value.trim() ? value.trim() : null);

  return db.transaction(async (tx) => {
    const [proposal] = await tx
      .insert(proposals)
      .values({
        projectId: input.projectId,
        clientId: input.clientId,
        title: draft.title.trim().slice(0, 200) || "Propuesta",
        context: text(s.context),
        diagnosis: text(s.diagnosis),
        mainObjective: text(s.main_objective),
        specificObjectives: text(s.specific_objectives),
        scope: text(s.scope),
        workStages: serializeStructuredContent(s.work_stages) || null,
        deliverables: serializeStructuredContent(s.deliverables) || null,
        timeline: text(s.timeline),
        clientRequirements: text(s.client_requirements),
        exclusions: text(s.exclusions),
        commercialConditions: text(s.commercial_conditions),
        nextAction: text(s.next_action),
        discountLabel: normalized.discount?.label ?? null,
        discountKind: normalized.discount?.kind ?? null,
        discountValue: normalized.discount
          ? String(normalized.discount.value)
          : null,
        createdBy: input.userId,
      })
      .returning({ id: proposals.id });
    await tx
      .update(proposals)
      .set({ rootId: proposal.id })
      .where(eq(proposals.id, proposal.id));

    const newServiceIds: string[] = [];
    const customIndex: number[] = [];
    for (const [index, line] of normalized.lines.entries()) {
      let serviceId = line.serviceId;
      if (!serviceId && line.custom) {
        const c = line.custom;
        const [subarea] = c.subarea
          ? await tx
              .select({ id: serviceSubareas.id })
              .from(serviceSubareas)
              .where(
                and(
                  eq(serviceSubareas.area, c.area),
                  eq(serviceSubareas.name, c.subarea),
                ),
              )
              .limit(1)
          : [];
        const price = line.unitPrice != null ? String(line.unitPrice) : null;
        const [service] = await tx
          .insert(services)
          .values({
            name: c.name,
            area: c.area,
            subarea: subarea ? c.subarea : null,
            category: subarea ? null : c.subarea,
            unit: c.unit,
            description: c.description || null,
            methodology: c.methodology || null,
            deliverables: c.deliverables || null,
            exclusions: c.exclusions || null,
            estimatedTime: c.estimatedTime,
            priceMinAmount: price,
            priceMaxAmount: price,
            priceCurrency: line.currency,
            status: "En revisión",
            suggestedByAi: true,
            originProposalId: proposal.id,
            relatedServices: c.basedOnServiceId ? [c.basedOnServiceId] : [],
            createdBy: input.userId,
          })
          .returning({ id: services.id });
        const variant = {
          serviceId: service.id,
          description: c.description || null,
          methodology: c.methodology || null,
          deliverables: c.deliverables || null,
          exclusions: c.exclusions || null,
          estimatedTime: c.estimatedTime,
          priceMinAmount: price,
          priceMaxAmount: price,
          priceCurrency: line.currency,
          createdBy: input.userId,
        };
        // START habilitado; GROWTH queda creado y apagado para completarlo en el catálogo.
        await tx.insert(serviceVariants).values([
          { ...variant, tier: "START", enabled: true },
          { ...variant, tier: "GROWTH", enabled: false },
        ]);
        serviceId = service.id;
        newServiceIds.push(service.id);
        customIndex.push(index);
      }
      if (!serviceId) continue;
      await tx
        .insert(proposalServices)
        .values({
          proposalId: proposal.id,
          serviceId,
          variantTier: line.tier,
          position: index,
          quantity: line.quantity,
          // Personalizados: el valor ya está en el servicio nuevo.
          customPriceAmount:
            line.kind === "catalogo" && line.unitPrice != null
              ? String(line.unitPrice)
              : null,
          customPriceCurrency:
            line.kind === "catalogo" && line.unitPrice != null
              ? line.currency
              : null,
        })
        .onConflictDoNothing();
    }

    if (normalized.team.length) {
      await tx.insert(proposalTeam).values(
        normalized.team.map((member, position) => ({
          proposalId: proposal.id,
          memberId: member.memberId,
          roleInProject: member.role || null,
          position,
        })),
      );
    }

    await tx
      .update(projects)
      .set({ commercialStage: "Propuesta", updatedAt: new Date() })
      .where(eq(projects.id, input.projectId));

    return { proposalId: proposal.id, newServiceIds, customIndex };
  });
}
