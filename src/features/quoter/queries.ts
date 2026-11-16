import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  proposalPrecedents,
  proposals,
  quoterLearnings,
  quoterRuns,
  services,
} from "@/db/schema";
import type { NormalizedLine } from "./normalize";
import type { ProposalDraft } from "./schema";

export type DraftRunView = {
  id: string;
  model: string | null;
  createdAt: Date;
  createdByEmail: string | null;
  draft: ProposalDraft | null;
  lines: (NormalizedLine & { serviceId: string | null })[];
  warnings: string[];
  learnings: { id: string; statement: string; active: boolean }[];
  precedents: {
    id: string;
    code: string | null;
    clientName: string | null;
    title: string | null;
  }[];
  instructions: string | null;
};

/** Último borrador de IA de la propuesta (o de su cadena de versiones). */
export async function getDraftRunForProposal(
  proposalId: string,
  rootId: string,
): Promise<DraftRunView | null> {
  const versions = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(eq(proposals.rootId, rootId));
  const ids = [...new Set([proposalId, rootId, ...versions.map((v) => v.id)])];
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
  if (!run) return null;
  const output = (run.output ?? {}) as {
    draft?: ProposalDraft;
    lines?: DraftRunView["lines"];
    warnings?: string[];
    appliedLearningIds?: string[];
    precedentIds?: string[];
  };
  const learningIds = output.appliedLearningIds ?? [];
  const precedentIds = output.precedentIds ?? [];
  const [learnings, precedents] = await Promise.all([
    learningIds.length
      ? db
          .select({
            id: quoterLearnings.id,
            statement: quoterLearnings.statement,
            active: quoterLearnings.active,
          })
          .from(quoterLearnings)
          .where(inArray(quoterLearnings.id, learningIds))
      : Promise.resolve([]),
    precedentIds.length
      ? db
          .select({
            id: proposalPrecedents.id,
            code: proposalPrecedents.code,
            clientName: proposalPrecedents.clientName,
            title: proposalPrecedents.title,
          })
          .from(proposalPrecedents)
          .where(inArray(proposalPrecedents.id, precedentIds))
      : Promise.resolve([]),
  ]);
  const refs = (run.contextRefs ?? {}) as { instructions?: string | null };
  return {
    id: run.id,
    model: run.model,
    createdAt: run.createdAt,
    createdByEmail: run.createdByEmail,
    draft: output.draft ?? null,
    lines: output.lines ?? [],
    warnings: output.warnings ?? [],
    learnings,
    precedents,
    instructions: refs.instructions ?? null,
  };
}

export async function listLearnings() {
  return db
    .select({
      id: quoterLearnings.id,
      kind: quoterLearnings.kind,
      scope: quoterLearnings.scope,
      area: quoterLearnings.area,
      industry: quoterLearnings.industry,
      statement: quoterLearnings.statement,
      rationale: quoterLearnings.rationale,
      origin: quoterLearnings.origin,
      active: quoterLearnings.active,
      timesApplied: quoterLearnings.timesApplied,
      lastAppliedAt: quoterLearnings.lastAppliedAt,
      createdAt: quoterLearnings.createdAt,
      createdByEmail: quoterLearnings.createdByEmail,
      serviceName: services.name,
      clientName: clients.companyName,
      sourceProposalId: quoterLearnings.sourceProposalId,
      sourceProposalTitle: proposals.title,
    })
    .from(quoterLearnings)
    .leftJoin(services, eq(services.id, quoterLearnings.serviceId))
    .leftJoin(clients, eq(clients.id, quoterLearnings.clientId))
    .leftJoin(proposals, eq(proposals.id, quoterLearnings.sourceProposalId))
    .orderBy(desc(quoterLearnings.active), desc(quoterLearnings.createdAt));
}

export async function quoterMemoryStats() {
  const [runs, precedents] = await Promise.all([
    db
      .select({ kind: quoterRuns.kind, status: quoterRuns.status })
      .from(quoterRuns),
    db.select({ source: proposalPrecedents.source }).from(proposalPrecedents),
  ]);
  return {
    drafts: runs.filter((r) => r.kind === "draft" && r.status === "done")
      .length,
    briefs: runs.filter((r) => r.kind === "brief" && r.status === "done")
      .length,
    learningRuns: runs.filter(
      (r) => r.kind === "learning" && r.status === "done",
    ).length,
    precedentsHistoric: precedents.filter((p) => p.source === "historico")
      .length,
    precedentsNoma: precedents.filter((p) => p.source === "noma").length,
  };
}
