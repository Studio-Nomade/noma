/**
 * Mapeo de la salida de la IA (notas → brief) al contrato estable del brief
 * (`BriefExtraction`) y a la ficha del cliente. Puro, para testear.
 */

import type { Area } from "@/types/enums";
import type { BriefExtraction } from "@/features/ai/brief-processor";
import { BRIEF_FIELDS_BY_AREA } from "@/features/briefs/fields";
import type { BriefAiOutput } from "./schema";

export type ClientProfilePatch = Partial<{
  industry: string;
  website: string;
  instagram: string;
  linkedin: string;
  comuna: string;
  region: string;
  rut: string;
  legalName: string;
}>;

export function mapBriefAi(
  output: BriefAiOutput,
  input: {
    mainArea: Area;
    involvedAreas: Area[];
    catalogNames: Map<string, string>;
  },
): BriefExtraction {
  const areas = [input.mainArea, ...input.involvedAreas];
  const answeredByArea: BriefExtraction["answeredByArea"] = {};
  const pendingByArea: BriefExtraction["pendingByArea"] = {};
  for (const area of areas) {
    const fields = BRIEF_FIELDS_BY_AREA[area] ?? [];
    const answered = output.answered
      .filter((a) => a.area === area && a.answer.trim())
      .map((a) => {
        const field = fields.find((f) => f.key === a.key);
        return field
          ? { question: field.label, answer: a.answer.trim() }
          : null;
      })
      .filter((x): x is { question: string; answer: string } => x != null);
    answeredByArea[area] = answered;
    const answeredLabels = new Set(answered.map((a) => a.question));
    pendingByArea[area] = [
      ...output.pending
        .filter((p) => p.area === area)
        .map((p) => p.question.trim()),
      ...fields.filter((f) => !answeredLabels.has(f.label)).map((f) => f.label),
    ].filter((q, i, list) => q && list.indexOf(q) === i);
  }
  const general = output.pending.filter(
    (p) => !p.area || !areas.includes(p.area),
  );
  if (general.length) {
    pendingByArea.General = general
      .map((p) => p.question.trim())
      .filter(Boolean);
  }

  const suggested = output.suggested_service_ids
    .map((id) => input.catalogNames.get(id))
    .filter((name): name is string => Boolean(name));

  return {
    engine: "claude",
    executiveSummary: output.executive_summary.trim(),
    clientContext: output.client_context.trim(),
    explicitNeed: output.explicit_need.trim(),
    implicitNeed: output.implicit_need.trim(),
    coreProblem: output.core_problem.trim(),
    objectives: output.objectives
      .map((o) => o.trim())
      .filter(Boolean)
      .slice(0, 6),
    targetAudience: output.target_audience.trim(),
    requestedServices: output.requested_services
      .map((s) => s.trim())
      .filter(Boolean),
    suggestedServices: [...new Set(suggested)],
    mainArea: input.mainArea,
    involvedAreas: input.involvedAreas,
    answeredByArea,
    pendingByArea,
    risks: output.risks.map((r) => r.trim()).filter(Boolean),
    deadlines: output.deadlines.trim(),
    budget: output.budget.trim(),
    decisionMakers: output.decision_makers.trim(),
    nextSteps: output.next_steps.map((n) => n.trim()).filter(Boolean),
    commercialRecommendation: output.commercial_recommendation.trim(),
    closeProbability: Math.max(
      0,
      Math.min(100, Math.round(output.close_probability || 0)),
    ),
  };
}

const clean = (value: string | null | undefined) => {
  const text = value?.trim();
  return text && !/^(null|n\/a|no (se )?menciona.*)$/i.test(text)
    ? text
    : undefined;
};

/**
 * Datos de la ficha del cliente que la reunión aporta. Solo completa campos
 * vacíos: nunca pisa lo que el equipo ya cargó.
 */
export function clientPatchFromBrief(
  profile: BriefAiOutput["client_profile"],
  current: {
    industry: string | null;
    website: string | null;
    instagram: string | null;
    linkedin: string | null;
    comuna: string | null;
    region: string | null;
    rut: string | null;
    legalName: string | null;
  },
): ClientProfilePatch {
  const patch: ClientProfilePatch = {};
  const candidates: [keyof ClientProfilePatch, string | undefined][] = [
    ["industry", clean(profile.industry)],
    ["website", clean(profile.website)],
    ["instagram", clean(profile.instagram)],
    ["linkedin", clean(profile.linkedin)],
    ["comuna", clean(profile.comuna)],
    ["region", clean(profile.region)],
    ["rut", clean(profile.rut)],
    ["legalName", clean(profile.legal_name)],
  ];
  for (const [key, value] of candidates) {
    if (value && !current[key]?.trim()) patch[key] = value.slice(0, 300);
  }
  return patch;
}
