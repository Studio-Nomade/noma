import "server-only";

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  briefs,
  clientContacts,
  clients,
  proposalPrecedents,
  projects,
  proposals,
  quoterLearnings,
  serviceVariants,
  services,
  teamMembers,
} from "@/db/schema";
import { getLatestRates } from "@/lib/currency/rates";
import type { Area, Currency } from "@/types/enums";
import type { ServiceTier } from "@/features/services/tiers";
import type { CatalogRef } from "./normalize";
import type {
  BriefEntry,
  CatalogEntry,
  ClientEntry,
  DraftPromptInput,
  LearningEntry,
  PrecedentEntry,
  TeamEntry,
} from "./prompt";
import { orTsQuery, searchTerms } from "./search";
import { richTextPlain } from "./text";

const num = (value: string | number | null | undefined) =>
  value == null || value === "" ? null : Number(value);

const fmt = (value: number) =>
  Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(".", ",");

// ── Catálogo con historial de valores cotizados ─────────────
export async function loadCatalog(): Promise<{
  entries: CatalogEntry[];
  refs: CatalogRef[];
}> {
  const rows = await db
    .select()
    .from(services)
    .where(inArray(services.status, ["Activo", "En revisión"]))
    .orderBy(services.area, services.subarea, services.name);
  const variants = await db.select().from(serviceVariants);
  const byService = new Map<string, (typeof variants)[number][]>();
  for (const v of variants) {
    const list = byService.get(v.serviceId) ?? [];
    list.push(v);
    byService.set(v.serviceId, list);
  }

  // Valores efectivamente cotizados (propuestas enviadas, aprobadas o rechazadas).
  const { rows: history } = await db.execute<{
    service_id: string;
    quoted: number;
    approved: number;
    last_amounts: string[] | null;
  }>(sql`
    select ps.service_id,
           count(*)::int as quoted,
           count(*) filter (where p.status = 'Aprobada')::int as approved,
           (array_agg(
              coalesce(ps.custom_price_amount, sv.price_min_amount, s.price_min_amount)::text
              || ' ' || coalesce(ps.custom_price_currency::text, sv.price_currency::text, 'UF')
              || ' ' || ps.variant_tier
              order by p.updated_at desc
           ))[1:3] as last_amounts
      from proposal_services ps
      join proposals p on p.id = ps.proposal_id
      join services s on s.id = ps.service_id
      left join service_variants sv on sv.service_id = ps.service_id and sv.tier = ps.variant_tier
     where p.status in ('Enviada', 'Aprobada', 'Rechazada')
     group by ps.service_id
  `);
  const historyById = new Map(history.map((h) => [h.service_id, h]));

  const entries: CatalogEntry[] = [];
  const refs: CatalogRef[] = [];
  for (const s of rows) {
    const vs = (byService.get(s.id) ?? []).sort(
      (a, b) => tierOrder(a.tier) - tierOrder(b.tier),
    );
    const enabled = vs.filter((v) => v.enabled);
    const h = historyById.get(s.id);
    entries.push({
      id: s.id,
      name: s.name,
      area: s.area as Area,
      subarea: s.subarea,
      unit: s.unit,
      status: s.status,
      description: richTextPlain(s.description),
      deliverables: richTextPlain(s.deliverables),
      exclusions: richTextPlain(s.exclusions),
      estimatedTime: s.estimatedTime,
      variants: (enabled.length ? enabled : []).map((v) => ({
        tier: v.tier,
        min: num(v.priceMinAmount),
        max: num(v.priceMaxAmount),
        currency: v.priceCurrency,
        focus: v.focus,
      })),
      history: h
        ? {
            quoted: h.quoted,
            approved: h.approved,
            lastAmounts: (h.last_amounts ?? []).map((a) => {
              const [amount, currency, tier] = a.split(" ");
              const n = Number(amount);
              return `${Number.isFinite(n) ? fmt(n) : amount} ${currency} ${tier}`;
            }),
          }
        : null,
    });
    // Servicios antiguos sin variantes: el valor base cuenta como START.
    const tiers = enabled.length
      ? enabled.map((v) => ({
          tier: v.tier as ServiceTier,
          min: num(v.priceMinAmount),
          currency: v.priceCurrency as Currency,
        }))
      : vs.length
        ? []
        : [
            {
              tier: "START" as ServiceTier,
              min: num(s.priceMinAmount),
              currency: (s.priceCurrency ?? "UF") as Currency,
            },
          ];
    refs.push({
      id: s.id,
      name: s.name,
      area: s.area as Area,
      enabledTiers: tiers,
    });
  }
  return { entries, refs };
}

function tierOrder(tier: string) {
  return ["START", "GROWTH", "PERFORMANCE", "ENTERPRISE"].indexOf(tier);
}

// ── Memoria ──────────────────────────────────────────────────
export async function loadLearnings(input: {
  areas: Area[];
  clientId: string | null;
  industry: string | null;
}): Promise<LearningEntry[]> {
  const filters = [
    eq(quoterLearnings.scope, "global"),
    eq(quoterLearnings.scope, "servicio"),
  ];
  if (input.areas.length) {
    filters.push(
      and(
        eq(quoterLearnings.scope, "area"),
        inArray(quoterLearnings.area, input.areas),
      )!,
    );
  }
  if (input.clientId) {
    filters.push(
      and(
        eq(quoterLearnings.scope, "cliente"),
        eq(quoterLearnings.clientId, input.clientId),
      )!,
    );
  }
  if (input.industry?.trim()) {
    filters.push(
      and(
        eq(quoterLearnings.scope, "rubro"),
        sql`${quoterLearnings.industry} is not null and (
          ${input.industry} ilike '%' || ${quoterLearnings.industry} || '%'
          or ${quoterLearnings.industry} ilike '%' || ${input.industry} || '%')`,
      )!,
    );
  }
  const rows = await db
    .select({
      id: quoterLearnings.id,
      kind: quoterLearnings.kind,
      scope: quoterLearnings.scope,
      area: quoterLearnings.area,
      industry: quoterLearnings.industry,
      statement: quoterLearnings.statement,
      serviceName: services.name,
      clientName: clients.companyName,
    })
    .from(quoterLearnings)
    .leftJoin(services, eq(services.id, quoterLearnings.serviceId))
    .leftJoin(clients, eq(clients.id, quoterLearnings.clientId))
    .where(and(eq(quoterLearnings.active, true), or(...filters)))
    .orderBy(desc(quoterLearnings.updatedAt))
    .limit(80);
  return rows.map((r) => ({
    ...r,
    kind: r.kind as LearningEntry["kind"],
    scope: r.scope as LearningEntry["scope"],
    area: (r.area as Area | null) ?? null,
  }));
}

// ── Precedentes parecidos ────────────────────────────────────
export async function findPrecedents(input: {
  text: string;
  clientId: string | null;
  areas: Area[];
  excludeProposalId?: string | null;
  limit?: number;
}): Promise<PrecedentEntry[]> {
  const query = orTsQuery(searchTerms(input.text));
  const document = sql`to_tsvector('spanish',
      coalesce(${proposalPrecedents.title}, '') || ' ' ||
      coalesce(${proposalPrecedents.clientName}, '') || ' ' ||
      coalesce(${proposalPrecedents.summary}, '') || ' ' ||
      coalesce(${proposalPrecedents.rawText}, ''))`;
  const rank = query
    ? sql`ts_rank(${document}, to_tsquery('spanish', ${query}))`
    : sql`0`;
  const clientBoost = input.clientId
    ? sql`case when ${proposalPrecedents.clientId} = ${input.clientId} then 1 else 0 end`
    : sql`0`;
  const areaBoost = input.areas.length
    ? sql`case when ${proposalPrecedents.areas} && ${sql.raw(
        `ARRAY[${input.areas.map((a) => `'${a.replace(/'/g, "''")}'`).join(",")}]::area[]`,
      )} then 0.15 else 0 end`
    : sql`0`;
  const sourceBoost = sql`case when ${proposalPrecedents.source} = 'noma' then 0.1 else 0 end`;
  const score = sql<number>`(${rank} + ${clientBoost} + ${areaBoost} + ${sourceBoost})`;

  const rows = await db
    .select({
      id: proposalPrecedents.id,
      source: proposalPrecedents.source,
      code: proposalPrecedents.code,
      clientName: proposalPrecedents.clientName,
      issuedOn: proposalPrecedents.issuedOn,
      areas: proposalPrecedents.areas,
      title: proposalPrecedents.title,
      summary: proposalPrecedents.summary,
      lines: proposalPrecedents.lines,
      totalUf: proposalPrecedents.totalUf,
      conditions: proposalPrecedents.conditions,
      outcome: proposalPrecedents.outcome,
      excerpt: sql<string | null>`left(${proposalPrecedents.rawText}, 1500)`,
      score,
    })
    .from(proposalPrecedents)
    .where(
      input.excludeProposalId
        ? sql`${proposalPrecedents.proposalId} is distinct from ${input.excludeProposalId}`
        : undefined,
    )
    .orderBy(desc(score), desc(proposalPrecedents.issuedOn))
    .limit(input.limit ?? 6);

  return rows
    .filter((r) => Number(r.score) > 0)
    .map((r) => ({
      id: r.id,
      source: r.source as PrecedentEntry["source"],
      code: r.code,
      clientName: r.clientName,
      issuedOn: r.issuedOn,
      areas: (r.areas ?? []) as string[],
      title: r.title,
      summary: r.summary,
      lines: r.lines ?? [],
      totalUf: num(r.totalUf),
      conditions: r.conditions,
      outcome: r.outcome,
      excerpt: r.excerpt,
    }));
}

// ── Cliente, brief y equipo ──────────────────────────────────
export async function loadClient(
  clientId: string,
): Promise<ClientEntry & { id: string }> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) throw new Error("Cliente no encontrado.");
  const contacts = await db
    .select({ name: clientContacts.name, role: clientContacts.role })
    .from(clientContacts)
    .where(eq(clientContacts.clientId, clientId))
    .limit(10);
  const history = await db
    .select({
      title: proposals.title,
      status: proposals.status,
      date: proposals.createdAt,
    })
    .from(proposals)
    .where(eq(proposals.clientId, clientId))
    .orderBy(desc(proposals.createdAt))
    .limit(8);
  return {
    id: client.id,
    companyName: client.companyName,
    industry: client.industry,
    website: client.website,
    status: client.status,
    notes: client.internalNotes,
    contacts: [
      ...(client.contactName
        ? [{ name: client.contactName, role: client.contactRole }]
        : []),
      ...contacts,
    ],
    history: history.map((h) => ({
      title: h.title,
      status: h.status,
      date: h.date.toISOString().slice(0, 10),
    })),
  };
}

export async function loadBrief(projectId: string) {
  const [row] = await db
    .select({ brief: briefs, project: projects })
    .from(briefs)
    .innerJoin(projects, eq(projects.id, briefs.projectId))
    .where(eq(briefs.projectId, projectId))
    .limit(1);
  if (!row) return null;
  const { brief, project } = row;
  const ext = (brief.aiExtraction ?? {}) as { suggestedServices?: string[] };
  const entry: BriefEntry = {
    projectName: project.name,
    mainArea: brief.area as Area,
    involvedAreas: (brief.involvedAreas ?? []) as Area[],
    fields: {
      contextGeneral: brief.contextGeneral ?? "",
      problem: brief.problem ?? "",
      mainObjective: brief.mainObjective ?? "",
      expectedOutcome: brief.expectedOutcome ?? "",
      targetAudience: brief.targetAudience ?? "",
      idealDeadline: brief.idealDeadline ?? "",
      budgetMentioned: brief.budgetMentioned ?? "",
      decisionMakers: brief.decisionMakers ?? "",
      urgency: brief.urgency ?? "",
      restrictions: brief.restrictions ?? "",
      availableMaterials: brief.availableMaterials ?? "",
      pendingInfo: brief.pendingInfo ?? "",
      generalComments: brief.generalComments ?? "",
      commercialRecs: brief.commercialRecs ?? "",
      risks: brief.risks ?? "",
    },
    areaAnswers: brief.areaBlocks ?? {},
    suggestedServices: ext.suggestedServices ?? [],
  };
  return { brief, project, entry };
}

export async function loadTeam(): Promise<TeamEntry[]> {
  const rows = await db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      role: teamMembers.roleTitle,
    })
    .from(teamMembers)
    .where(eq(teamMembers.status, "Activo"))
    .orderBy(teamMembers.name);
  return rows;
}

/** Todo el contexto del borrador para un proyecto con brief aprobado. */
export async function buildDraftContext(
  projectId: string,
  instructions?: string | null,
) {
  const loaded = await loadBrief(projectId);
  if (!loaded) throw new Error("La oportunidad no tiene brief.");
  const { brief, project, entry } = loaded;
  const client = await loadClient(project.clientId);
  const areas = [
    ...new Set([
      entry.mainArea,
      ...entry.involvedAreas,
      ...((project.areas ?? []) as Area[]),
    ]),
  ];
  const [catalog, learnings, rates] = await Promise.all([
    loadCatalog(),
    loadLearnings({ areas, clientId: client.id, industry: client.industry }),
    getLatestRates().catch(() => ({ ufClp: 0 })),
  ]);
  const searchText = [
    project.name,
    client.industry,
    ...Object.values(entry.fields),
    ...entry.suggestedServices,
  ]
    .filter(Boolean)
    .join(" ");
  const precedents = await findPrecedents({
    text: searchText,
    clientId: client.id,
    areas,
  });
  const team = await loadTeam();
  const prompt: DraftPromptInput = {
    catalog: catalog.entries,
    learnings,
    precedents,
    client,
    brief: entry,
    team,
    today: new Date().toLocaleDateString("es-CL", {
      timeZone: "America/Santiago",
    }),
    ufClp: rates.ufClp || null,
    instructions,
  };
  return {
    brief,
    project,
    client,
    catalog,
    learnings,
    precedents,
    team,
    prompt,
  };
}
