import "server-only";

import { and, asc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { botMessages, clientRequests, clients, projects } from "@/db/schema";

export type BotAnalyticsFilters = {
  clientId?: string;
  from: Date;
  to: Date;
};

export type BotAnalytics = {
  totals: {
    requests: number;
    additional: number;
    additionalRate: number;
    averageResponseMinutes: number | null;
    averageAsanaMinutes: number | null;
    classificationAccuracy: number | null;
    corrected: number;
  };
  byClient: Array<{
    id: string;
    name: string;
    requests: number;
    additional: number;
  }>;
  byProject: Array<{
    id: string;
    name: string;
    requests: number;
    additional: number;
  }>;
  byArea: Array<{ name: string; requests: number; additional: number }>;
  monthly: Array<{ period: string; requests: number; additional: number }>;
  weekly: Array<{ period: string; requests: number }>;
  topTypes: Array<{ name: string; requests: number }>;
};

export async function getBotAnalytics(
  filters: BotAnalyticsFilters,
): Promise<BotAnalytics> {
  const conditions: SQL[] = [
    gte(clientRequests.createdAt, filters.from),
    lte(clientRequests.createdAt, filters.to),
  ];
  if (filters.clientId) {
    conditions.push(eq(clientRequests.clientId, filters.clientId));
  }

  const rows = await db
    .select({
      id: clientRequests.id,
      clientId: clientRequests.clientId,
      clientName: clients.companyName,
      projectId: clientRequests.projectId,
      projectName: projects.name,
      projectArea: projects.area,
      projectAreas: projects.areas,
      conversationId: clientRequests.conversationId,
      summary: clientRequests.normalizedSummary,
      rawText: clientRequests.rawText,
      scopeClass: clientRequests.scopeClass,
      predictedScopeClass: clientRequests.predictedScopeClass,
      scopeCorrectedAt: clientRequests.scopeCorrectedAt,
      asanaAttemptedAt: clientRequests.asanaAttemptedAt,
      createdAt: clientRequests.createdAt,
    })
    .from(clientRequests)
    .innerJoin(clients, eq(clientRequests.clientId, clients.id))
    .innerJoin(projects, eq(clientRequests.projectId, projects.id))
    .where(and(...conditions))
    .orderBy(asc(clientRequests.createdAt));

  const conversationIds = [
    ...new Set(
      rows
        .map((row) => row.conversationId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const responseRows = conversationIds.length
    ? await db
        .select({
          conversationId: botMessages.conversationId,
          role: botMessages.role,
          createdAt: botMessages.createdAt,
        })
        .from(botMessages)
        // One query for all related conversations; the first assistant
        // message after each request is resolved in memory below.
        .where(inArray(botMessages.conversationId, conversationIds))
        .orderBy(asc(botMessages.createdAt))
    : [];

  const responsesByConversation = new Map<string, Date[]>();
  for (const message of responseRows) {
    if (message.role !== "assistant") continue;
    const dates = responsesByConversation.get(message.conversationId) ?? [];
    dates.push(message.createdAt);
    responsesByConversation.set(message.conversationId, dates);
  }

  const byClient = new Map<string, Aggregate>();
  const byProject = new Map<string, Aggregate>();
  const byArea = new Map<string, Aggregate>();
  const monthly = new Map<string, Aggregate>();
  const weekly = new Map<string, number>();
  const topTypes = new Map<string, number>();
  const responseMinutes: number[] = [];
  const asanaMinutes: number[] = [];
  let additional = 0;
  let corrected = 0;
  let comparable = 0;

  for (const row of rows) {
    const isAdditional = row.scopeClass === "additional";
    if (isAdditional) additional += 1;
    bump(byClient, row.clientId, row.clientName, isAdditional);
    bump(byProject, row.projectId, row.projectName, isAdditional);
    for (const area of row.projectAreas.length
      ? row.projectAreas
      : [row.projectArea]) {
      bump(byArea, area, area, isAdditional);
    }
    const month = row.createdAt.toISOString().slice(0, 7);
    bump(monthly, month, month, isAdditional);
    const week = isoWeek(row.createdAt);
    weekly.set(week, (weekly.get(week) ?? 0) + 1);
    const type = inferRequestType(row.summary ?? row.rawText);
    topTypes.set(type, (topTypes.get(type) ?? 0) + 1);

    if (row.predictedScopeClass) {
      comparable += 1;
      if (row.scopeCorrectedAt || row.predictedScopeClass !== row.scopeClass) {
        corrected += 1;
      }
    }
    if (row.asanaAttemptedAt) {
      asanaMinutes.push(
        Math.max(
          0,
          (row.asanaAttemptedAt.getTime() - row.createdAt.getTime()) / 60_000,
        ),
      );
    }
    if (row.conversationId) {
      const firstResponse = responsesByConversation
        .get(row.conversationId)
        ?.find((date) => date > row.createdAt);
      if (firstResponse) {
        responseMinutes.push(
          (firstResponse.getTime() - row.createdAt.getTime()) / 60_000,
        );
      }
    }
  }

  return {
    totals: {
      requests: rows.length,
      additional,
      additionalRate: percentage(additional, rows.length),
      averageResponseMinutes: average(responseMinutes),
      averageAsanaMinutes: average(asanaMinutes),
      classificationAccuracy:
        comparable > 0 ? percentage(comparable - corrected, comparable) : null,
      corrected,
    },
    byClient: aggregateRows(byClient),
    byProject: aggregateRows(byProject),
    byArea: aggregateRows(byArea).map(({ name, requests, additional }) => ({
      name,
      requests,
      additional,
    })),
    monthly: aggregateRows(monthly).map(
      ({ name: period, requests, additional }) => ({
        period,
        requests,
        additional,
      }),
    ),
    weekly: [...weekly]
      .map(([period, requests]) => ({ period, requests }))
      .sort((a, b) => a.period.localeCompare(b.period)),
    topTypes: [...topTypes]
      .map(([name, requests]) => ({ name, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 6),
  };
}

type Aggregate = {
  id: string;
  name: string;
  requests: number;
  additional: number;
};

function bump(
  map: Map<string, Aggregate>,
  id: string,
  name: string,
  isAdditional: boolean,
) {
  const current = map.get(id) ?? { id, name, requests: 0, additional: 0 };
  current.requests += 1;
  if (isAdditional) current.additional += 1;
  map.set(id, current);
}

function aggregateRows(map: Map<string, Aggregate>) {
  return [...map.values()].sort(
    (a, b) => b.requests - a.requests || a.name.localeCompare(b.name),
  );
}

function percentage(value: number, total: number) {
  return total ? Math.round((value / total) * 1_000) / 10 : 0;
}

function average(values: number[]) {
  if (!values.length) return null;
  return (
    Math.round(
      (values.reduce((total, value) => total + value, 0) / values.length) * 10,
    ) / 10
  );
}

function isoWeek(date: Date) {
  const value = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((value.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${value.getUTCFullYear()}-S${String(week).padStart(2, "0")}`;
}

function inferRequestType(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const clusters: Array<[string, RegExp]> = [
    ["Video / reel", /\b(video|reel|animacion|audiovisual)\b/],
    ["Diseño gráfico", /\b(diseno|pieza|grafica|banner|presentacion)\b/],
    ["Redes sociales", /\b(redes|social|instagram|linkedin|post|historia)\b/],
    ["Web", /\b(web|sitio|landing|pagina|seo)\b/],
    ["Marca", /\b(marca|branding|logo|identidad|manual)\b/],
    ["Campaña", /\b(campana|ads|publicidad|lanzamiento)\b/],
  ];
  return (
    clusters.find(([, pattern]) => pattern.test(normalized))?.[0] ?? "Otros"
  );
}
