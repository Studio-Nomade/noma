import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  projects,
  proposalNotes,
  proposalPrecedents,
  proposalServices,
  proposals,
  quoterLearnings,
  quoterRuns,
  serviceVariants,
  services,
} from "@/db/schema";
import type { Area, ProposalStatus } from "@/types/enums";
import { quoterAiConfig } from "./ai-config";
import { describeChanges, type DiffLine } from "./learn-diff";
import { parseStructuredContent } from "@/features/proposals/structured-content";
import { loadLearnings } from "./context";
import { quoterStructured } from "./llm";
import { renderLearnings } from "./prompt";
import { learningsAiSchema, type ProposalDraft } from "./schema";

const LEARNING_EVENTS = ["Enviada", "Aprobada", "Rechazada"] as const;
type LearningEvent = (typeof LEARNING_EVENTS)[number];

export function isLearningEvent(
  status: ProposalStatus,
): status is LearningEvent {
  return (LEARNING_EVENTS as readonly string[]).includes(status);
}

const SECTION_COLUMNS: Record<string, keyof typeof proposals.$inferSelect> = {
  context: "context",
  diagnosis: "diagnosis",
  main_objective: "mainObjective",
  specific_objectives: "specificObjectives",
  scope: "scope",
  work_stages: "workStages",
  deliverables: "deliverables",
  timeline: "timeline",
  client_requirements: "clientRequirements",
  exclusions: "exclusions",
  commercial_conditions: "commercialConditions",
  next_action: "nextAction",
};

const num = (value: string | null | undefined) =>
  value == null || value === "" ? null : Number(value);

/**
 * Se llama (en segundo plano) cuando una propuesta pasa a Enviada, Aprobada o
 * Rechazada:
 * 1. Guarda o actualiza la propuesta como precedente (valores finales).
 * 2. Compara con el borrador de la IA y el hilo de seguimiento, y le pide a
 *    Claude reglas generalizables. Entran activas a la memoria (decisión de
 *    Sebastián, 15-11-2026); se pueden desactivar en «Memoria del cotizador».
 * Idempotente por propuesta y evento. Nunca lanza.
 */
export async function learnFromProposal(
  proposalId: string,
  event: LearningEvent,
) {
  try {
    const loaded = await loadFinalProposal(proposalId);
    if (!loaded) return;
    await upsertPrecedent(loaded, event);

    const config = quoterAiConfig("learning");
    if (!config) return;

    const [already] = await db
      .select({ id: quoterRuns.id })
      .from(quoterRuns)
      .where(
        and(
          eq(quoterRuns.kind, "learning"),
          eq(quoterRuns.proposalId, proposalId),
          sql`${quoterRuns.contextRefs}->>'event' = ${event}`,
        ),
      )
      .limit(1);
    if (already) return;

    const draftRun = await findDraftRun(loaded.proposal.rootId ?? proposalId);
    const notes = await db
      .select({
        body: proposalNotes.body,
        at: proposalNotes.createdAt,
        by: proposalNotes.authorEmail,
      })
      .from(proposalNotes)
      .where(eq(proposalNotes.rootId, loaded.proposal.rootId ?? proposalId))
      .orderBy(proposalNotes.createdAt)
      .limit(40);
    const humanNotes = notes.filter(
      (n) => !/^Propuesta enviada a /.test(n.body),
    );

    const changes = draftRun
      ? describeChanges(buildDiff(draftRun, loaded))
      : [];
    // Sin borrador de IA y sin conversación: en "Enviada" no hay nada que
    // aprender todavía (queda como precedente). Aprobada/Rechazada sí enseñan.
    if (!changes.length && !humanNotes.length && event === "Enviada") return;

    const areas = loaded.areas;
    const existing = await loadLearnings({
      areas,
      clientId: loaded.proposal.clientId,
      industry: loaded.clientIndustry,
    });

    const [run] = await db
      .insert(quoterRuns)
      .values({
        kind: "learning",
        projectId: loaded.proposal.projectId,
        proposalId,
        contextRefs: {
          event,
          draftRunId: draftRun?.id ?? null,
          changes: changes.length,
        },
      })
      .returning({ id: quoterRuns.id });

    try {
      const result = await quoterStructured("learning", {
        feature: "quoter_learning",
        system: [
          {
            text: `Eres el analista comercial de Studio Nomade. Tu tarea: sacar reglas GENERALIZABLES para el cotizador a partir de lo que pasó con una propuesta (cambios del equipo al borrador de la IA, comentarios del hilo y el resultado con el cliente).

Reglas:
- Solo reglas que sirvan para futuras propuestas (precio, alcance, condiciones, redacción, catálogo o proceso). Nada anecdótico.
- Cada regla en una oración imperativa, con valores concretos cuando los hay (p. ej. "Cotiza X en 7 UF cuando el cliente entrega el material").
- Elige el alcance más estrecho correcto: servicio, cliente, rubro, área o global.
- Si una regla vigente queda corregida, indica su id en replaces_learning_id.
- No repitas reglas vigentes que ya dicen lo mismo.
- Si no hay nada generalizable, devuelve una lista vacía.`,
          },
          { text: renderLearnings(existing) },
        ],
        input: [
          `PROPUESTA: ${loaded.proposal.title} · cliente ${loaded.clientName ?? "?"}${
            loaded.clientIndustry ? ` (rubro ${loaded.clientIndustry})` : ""
          } · áreas ${areas.join(", ")} · estado ${event}`,
          `SERVICIOS FINALES (id · servicio · nivel · cantidad · valor):\n${loaded.lines
            .map(
              (l) =>
                `- [${l.serviceId}] ${l.name} · ${l.tier} · ${l.quantity} · ${l.amount ?? "s/v"} ${l.currency ?? ""}`,
            )
            .join("\n")}`,
          draftRun
            ? changes.length
              ? `CAMBIOS DEL EQUIPO AL BORRADOR DE LA IA:\n${changes.map((c) => `- ${c}`).join("\n")}`
              : "El equipo envió el borrador de la IA sin cambios relevantes."
            : "Esta propuesta se armó sin borrador de IA.",
          humanNotes.length
            ? `HILO DE SEGUIMIENTO:\n${humanNotes
                .map(
                  (n) =>
                    `- ${n.at.toISOString().slice(0, 10)} ${n.by ?? ""}: ${n.body.slice(0, 600)}`,
                )
                .join("\n")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        schema: learningsAiSchema,
        maxTokens: 6_000,
        timeoutMs: 90_000,
      });

      const known = new Set(existing.map((l) => l.id));
      const serviceIds = new Set(loaded.lines.map((l) => l.serviceId));
      const rows = result.data.learnings
        .slice(0, 5)
        .filter((l) => l.statement.trim());
      for (const l of rows) {
        const serviceId =
          l.service_id && serviceIds.has(l.service_id) ? l.service_id : null;
        const scope =
          l.scope === "servicio" && !serviceId
            ? "global"
            : l.scope === "cliente" && !loaded.proposal.clientId
              ? "global"
              : l.scope;
        await db.insert(quoterLearnings).values({
          kind: l.kind,
          scope,
          area: scope === "area" ? (l.area ?? areas[0] ?? null) : l.area,
          serviceId: scope === "servicio" ? serviceId : null,
          clientId: scope === "cliente" ? loaded.proposal.clientId : null,
          industry:
            scope === "rubro" ? (l.industry ?? loaded.clientIndustry) : null,
          statement: l.statement.trim().slice(0, 600),
          rationale: l.rationale.trim().slice(0, 1_000),
          origin: "ia",
          sourceProposalId: proposalId,
          sourceRunId: run.id,
        });
        if (l.replaces_learning_id && known.has(l.replaces_learning_id)) {
          await db
            .update(quoterLearnings)
            .set({ active: false, updatedAt: new Date() })
            .where(eq(quoterLearnings.id, l.replaces_learning_id));
        }
      }
      await db
        .update(quoterRuns)
        .set({
          status: "done",
          provider: result.provider,
          model: result.model,
          durationMs: result.durationMs,
          output: { learnings: result.data.learnings, changes },
          finishedAt: new Date(),
        })
        .where(eq(quoterRuns.id, run.id));
    } catch (error) {
      await db
        .update(quoterRuns)
        .set({
          status: "failed",
          error:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Error desconocido",
          finishedAt: new Date(),
        })
        .where(eq(quoterRuns.id, run.id));
      throw error;
    }
  } catch (error) {
    console.error("[quoter:learn]", error);
  }
}

async function loadFinalProposal(proposalId: string) {
  const [row] = await db
    .select({
      proposal: proposals,
      clientName: clients.companyName,
      clientIndustry: clients.industry,
      projectAreas: projects.areas,
      projectArea: projects.area,
    })
    .from(proposals)
    .innerJoin(projects, eq(projects.id, proposals.projectId))
    .leftJoin(clients, eq(clients.id, proposals.clientId))
    .where(eq(proposals.id, proposalId))
    .limit(1);
  if (!row) return null;
  const lineRows = await db
    .select({
      serviceId: proposalServices.serviceId,
      name: services.name,
      unit: services.unit,
      tier: proposalServices.variantTier,
      quantity: proposalServices.quantity,
      custom: proposalServices.customPriceAmount,
      customCurrency: proposalServices.customPriceCurrency,
      variantMin: serviceVariants.priceMinAmount,
      variantCurrency: serviceVariants.priceCurrency,
      baseMin: services.priceMinAmount,
      baseCurrency: services.priceCurrency,
      position: proposalServices.position,
    })
    .from(proposalServices)
    .innerJoin(services, eq(services.id, proposalServices.serviceId))
    .leftJoin(
      serviceVariants,
      and(
        eq(serviceVariants.serviceId, proposalServices.serviceId),
        eq(serviceVariants.tier, proposalServices.variantTier),
      ),
    )
    .where(eq(proposalServices.proposalId, proposalId))
    .orderBy(proposalServices.position);
  const lines = lineRows.map((l) => ({
    serviceId: l.serviceId,
    name: l.name,
    unit: l.unit,
    tier: l.tier,
    quantity: l.quantity,
    amount: num(l.custom) ?? num(l.variantMin) ?? num(l.baseMin),
    currency:
      (l.custom != null ? l.customCurrency : null) ??
      l.variantCurrency ??
      l.baseCurrency ??
      "UF",
  }));
  const areas = [
    ...new Set([row.projectArea, ...((row.projectAreas ?? []) as string[])]),
  ] as Area[];
  return {
    proposal: row.proposal,
    clientName: row.clientName,
    clientIndustry: row.clientIndustry,
    areas,
    lines,
  };
}

type FinalProposal = NonNullable<Awaited<ReturnType<typeof loadFinalProposal>>>;

async function findDraftRun(rootId: string) {
  const versionIds = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(eq(proposals.rootId, rootId));
  const ids = [...new Set([rootId, ...versionIds.map((v) => v.id)])];
  const [run] = await db
    .select()
    .from(quoterRuns)
    .where(
      and(
        eq(quoterRuns.kind, "draft"),
        eq(quoterRuns.status, "done"),
        inArray(quoterRuns.proposalId, ids),
      ),
    )
    .orderBy(desc(quoterRuns.createdAt))
    .limit(1);
  return run ?? null;
}

type DraftOutput = {
  draft?: ProposalDraft;
  lines?: {
    serviceId: string | null;
    label: string;
    tier: string;
    quantity: number;
    unitPrice: number | null;
    currency: string;
  }[];
  discount?: { kind: string; value: number } | null;
};

function buildDiff(run: typeof quoterRuns.$inferSelect, final: FinalProposal) {
  const output = (run.output ?? {}) as DraftOutput;
  const finalById = new Map(final.lines.map((l) => [l.serviceId, l]));
  const draftLines: DiffLine[] = (output.lines ?? [])
    .filter((l): l is NonNullable<typeof l> & { serviceId: string } =>
      Boolean(l.serviceId),
    )
    .map((l) => ({
      serviceId: l.serviceId,
      name: l.label,
      tier: l.tier,
      quantity: l.quantity,
      // Valor del catálogo cuando la IA no fijó uno: el mismo que verá el equipo.
      amount: l.unitPrice ?? finalById.get(l.serviceId)?.amount ?? null,
      currency: l.currency,
    }));
  const asText = (value: unknown) =>
    Array.isArray(value)
      ? value
          .map((item: { title?: string; description?: string }) =>
            [item.title, item.description].filter(Boolean).join(": "),
          )
          .join("\n")
      : typeof value === "string"
        ? value
        : "";
  const sections: Record<string, string> = {};
  for (const [key, value] of Object.entries(output.draft?.sections ?? {})) {
    sections[key] = asText(value);
  }
  const finalSections: Record<string, string | null> = {};
  for (const [key, column] of Object.entries(SECTION_COLUMNS)) {
    const value = (final.proposal[column] as string | null) ?? null;
    finalSections[key] =
      key === "work_stages" || key === "deliverables"
        ? asText(
            parseStructuredContent(
              value,
              key === "work_stages" ? "stages" : "deliverables",
            ),
          )
        : value;
  }
  return {
    draftLines,
    finalLines: final.lines.map((l) => ({
      serviceId: l.serviceId,
      name: l.name,
      tier: l.tier,
      quantity: l.quantity,
      amount: l.amount,
      currency: l.currency,
    })),
    draftDiscount: output.discount ?? null,
    finalDiscount: {
      kind: final.proposal.discountKind,
      value: num(final.proposal.discountValue),
    },
    draftSections: sections,
    finalSections,
  };
}

async function upsertPrecedent(final: FinalProposal, event: LearningEvent) {
  const p = final.proposal;
  const ufLines = final.lines.filter(
    (l) => l.currency === "UF" && l.amount != null,
  );
  const oneOff = ufLines.filter((l) => !l.unit || /^único$/i.test(l.unit));
  const gross = oneOff.reduce(
    (sum, l) => sum + (l.amount ?? 0) * l.quantity,
    0,
  );
  const discount = num(p.discountValue);
  const net =
    p.discountKind === "percent" && discount
      ? gross * (1 - discount / 100)
      : p.discountKind === "uf" && discount
        ? gross - discount
        : gross;
  const values = {
    source: "noma",
    proposalId: p.id,
    code: null,
    clientName: final.clientName,
    clientId: p.clientId,
    issuedOn: (p.updatedAt ?? p.createdAt).toISOString().slice(0, 10),
    areas: final.areas,
    title: p.title,
    summary:
      [p.mainObjective, p.scope].filter(Boolean).join(" · ").slice(0, 1_200) ||
      null,
    lines: final.lines.map((l) => ({
      name: `${l.name} (${l.tier})`,
      amount: l.amount,
      currency: l.currency,
      unit: l.unit,
      quantity: l.quantity,
      note: null,
    })),
    totalUf: gross ? String(Math.round(net * 100) / 100) : null,
    conditions:
      [
        p.discountLabel && discount
          ? `${p.discountLabel}: ${discount} ${p.discountKind}`
          : null,
        p.commercialConditions,
      ]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 1_500) || null,
    outcome: event.toLowerCase(),
    rawText: [p.context, p.diagnosis, p.scope, p.deliverables, p.exclusions]
      .filter(Boolean)
      .join("\n")
      .slice(0, 20_000),
    updatedAt: new Date(),
  };
  await db
    .insert(proposalPrecedents)
    .values(values)
    .onConflictDoUpdate({ target: proposalPrecedents.proposalId, set: values });
}
