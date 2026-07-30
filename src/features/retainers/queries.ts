import "server-only";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clientRequests,
  clients,
  retainerPeriods,
  retainers,
} from "@/db/schema";
import { ensureCurrentPeriod, monthlyPeriodBounds } from "./periods";

export async function getProjectRetainer(projectId: string) {
  const [retainer] = await db
    .select()
    .from(retainers)
    .where(eq(retainers.projectId, projectId))
    .orderBy(
      sql`case when ${retainers.status} = 'active' then 0 else 1 end`,
      desc(retainers.updatedAt),
    )
    .limit(1);
  if (!retainer) return null;
  const period =
    retainer.status === "active"
      ? await ensureCurrentPeriod(retainer.id)
      : await db.query.retainerPeriods.findFirst({
          where: eq(retainerPeriods.retainerId, retainer.id),
          orderBy: desc(retainerPeriods.periodStart),
        });
  const history = period
    ? await db
        .select({
          id: clientRequests.id,
          summary: clientRequests.normalizedSummary,
          units: clientRequests.estimatedUnits,
          scopeClass: clientRequests.scopeClass,
          consumedAt: clientRequests.retainerConsumedAt,
          createdAt: clientRequests.createdAt,
        })
        .from(clientRequests)
        .where(eq(clientRequests.retainerPeriodId, period.id))
        .orderBy(desc(clientRequests.createdAt))
        .limit(20)
    : [];
  return { retainer, period: period ?? null, history };
}

export async function getRetainerHealth() {
  const bounds = monthlyPeriodBounds(new Date());
  return db
    .select({
      retainerId: retainers.id,
      clientId: retainers.clientId,
      clientName: clients.companyName,
      unit: retainers.unit,
      quota: retainerPeriods.quota,
      consumed: retainerPeriods.consumed,
      remaining: retainerPeriods.remaining,
      requests: sql<number>`count(${clientRequests.id})::int`,
      additional: sql<number>`count(${clientRequests.id}) filter (where ${clientRequests.scopeClass} = 'additional')::int`,
    })
    .from(retainers)
    .innerJoin(clients, eq(retainers.clientId, clients.id))
    .leftJoin(
      retainerPeriods,
      and(
        eq(retainerPeriods.retainerId, retainers.id),
        eq(retainerPeriods.periodStart, bounds.start),
      ),
    )
    .leftJoin(
      clientRequests,
      and(
        eq(clientRequests.projectId, retainers.projectId),
        gte(clientRequests.createdAt, new Date(`${bounds.start}T00:00:00Z`)),
        lte(clientRequests.createdAt, new Date(`${bounds.end}T23:59:59Z`)),
      ),
    )
    .where(eq(retainers.status, "active"))
    .groupBy(
      retainers.id,
      clients.id,
      retainerPeriods.id,
    )
    .orderBy(clients.companyName);
}
