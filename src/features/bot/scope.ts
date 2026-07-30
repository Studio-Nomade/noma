import "server-only";

import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { proposals, retainers } from "@/db/schema";
import type { BotChannelContextInput, BotContextPack } from "./context";
import { ensureCurrentPeriod } from "@/features/retainers/periods";

export type ScopeDecision = {
  scopeClass: "in_scope" | "additional" | "unknown";
  estimatedUnits: number | null;
  retainerPeriodId: string | null;
  remaining: number | null;
  unit: "deliverables" | "hours" | null;
  reason: string;
};

export async function classifyScope(input: {
  botChannel: Pick<BotChannelContextInput, "projectId">;
  summary: string;
  pack?: BotContextPack;
  date?: Date;
}): Promise<ScopeDecision> {
  const date = input.date ?? new Date();
  const today = date.toISOString().slice(0, 10);
  const [[retainer], [proposal]] = await Promise.all([
    db
      .select()
      .from(retainers)
      .where(
        and(
          eq(retainers.projectId, input.botChannel.projectId),
          eq(retainers.status, "active"),
          lte(retainers.startDate, today),
          or(isNull(retainers.endDate), gte(retainers.endDate, today)),
        ),
      )
      .limit(1),
    db
      .select({
        scope: proposals.scope,
        exclusions: proposals.exclusions,
        deliverables: proposals.deliverables,
      })
      .from(proposals)
      .where(eq(proposals.projectId, input.botChannel.projectId))
      .orderBy(desc(proposals.version), desc(proposals.createdAt))
      .limit(1),
  ]);

  const summaryTerms = significantTerms(input.summary);
  const exclusionMatches = matches(summaryTerms, proposal?.exclusions ?? "");
  if (
    explicitAdditional(input.summary) ||
    exclusionMatches.length > 0
  ) {
    return {
      scopeClass: "additional",
      estimatedUnits: retainer ? estimateUnits(input.summary, retainer.unit) : null,
      retainerPeriodId: null,
      remaining: null,
      unit: retainer?.unit === "hours" ? "hours" : retainer ? "deliverables" : null,
      reason: exclusionMatches.length
        ? `Coincide con exclusiones registradas (${exclusionMatches.slice(0, 4).join(", ")}).`
        : "La solicitud se presenta explícitamente como adicional o no incluida.",
    };
  }

  const contextText = [
    proposal?.scope,
    proposal?.deliverables,
    input.pack?.project.type,
    input.pack?.project.description,
    input.pack?.project.objective,
    ...(input.pack?.services.flatMap((service) => [
      service.name,
      service.description,
      service.deliverables,
    ]) ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  const scopeMatches = matches(summaryTerms, contextText);
  if (!scopeMatches.length) {
    return {
      scopeClass: "unknown",
      estimatedUnits: retainer ? estimateUnits(input.summary, retainer.unit) : null,
      retainerPeriodId: null,
      remaining: null,
      unit: retainer?.unit === "hours" ? "hours" : retainer ? "deliverables" : null,
      reason:
        "No hay evidencia suficiente en el alcance registrado; debe confirmarlo el equipo.",
    };
  }

  if (!retainer) {
    return {
      scopeClass: "in_scope",
      estimatedUnits: null,
      retainerPeriodId: null,
      remaining: null,
      unit: null,
      reason: `Coincide con el alcance registrado (${scopeMatches.slice(0, 4).join(", ")}).`,
    };
  }

  const period = await ensureCurrentPeriod(retainer.id, date);
  const estimatedUnits = estimateUnits(input.summary, retainer.unit);
  const remaining = period ? Number(period.remaining) : 0;
  const unit = retainer.unit === "hours" ? "hours" : "deliverables";
  if (!period || remaining < estimatedUnits) {
    return {
      scopeClass: "additional",
      estimatedUnits,
      retainerPeriodId: period?.id ?? null,
      remaining,
      unit,
      reason: `El alcance coincide, pero la bolsa no tiene saldo suficiente (${formatUnits(remaining, unit)} disponibles).`,
    };
  }
  return {
    scopeClass: "in_scope",
    estimatedUnits,
    retainerPeriodId: period.id,
    remaining,
    unit,
    reason: `Coincide con el alcance y hay ${formatUnits(remaining, unit)} disponibles.`,
  };
}

function explicitAdditional(summary: string) {
  return /\b(adicional|fuera de alcance|nuevo proyecto|no incluido)\b/i.test(
    summary,
  );
}

function estimateUnits(summary: string, unit: string) {
  if (unit !== "hours") return 1;
  const match = summary.match(
    /\b(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hora|horas)\b/i,
  );
  const parsed = match ? Number(match[1].replace(",", ".")) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function matches(requestTerms: string[], text: string) {
  const terms = new Set(significantTerms(text));
  return requestTerms.filter((term) => terms.has(term));
}

function significantTerms(value: string): string[] {
  const ignored = new Set([
    "para",
    "como",
    "este",
    "esta",
    "esto",
    "desde",
    "hasta",
    "sobre",
    "entre",
    "hacer",
    "necesito",
    "queremos",
    "cliente",
    "proyecto",
  ]);
  return [
    ...new Set(
      value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .match(/[\p{L}\p{N}]{4,}/gu)
        ?.filter((term) => !ignored.has(term)) ?? [],
    ),
  ];
}

function formatUnits(value: number, unit: "deliverables" | "hours") {
  return `${value.toLocaleString("es-CL")} ${unit === "hours" ? "h" : value === 1 ? "entregable" : "entregables"}`;
}
