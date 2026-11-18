import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  devLog,
  devMilestones,
  devModules,
  devPrograms,
  devPrs,
  devRoadmaps,
} from "@/db/schema";
import { compareRoadmapCodes } from "./roadmap-code";

export async function getDevProgramByProject(projectId: string) {
  const [program] = await db
    .select()
    .from(devPrograms)
    .where(eq(devPrograms.projectId, projectId))
    .limit(1);
  return program ?? null;
}

export type PrMonthRow = {
  month: string;
  byRepo: Record<string, number>;
  total: number;
};

export async function getDevTracking(projectId: string) {
  const program = await getDevProgramByProject(projectId);
  if (!program) return null;

  const [modules, milestones, roadmaps, prRows, log] = await Promise.all([
    db
      .select()
      .from(devModules)
      .where(
        and(
          eq(devModules.programId, program.id),
          sql`${devModules.archivedAt} is null`,
        ),
      )
      .orderBy(asc(devModules.sortOrder), asc(devModules.code)),
    db
      .select({
        id: devMilestones.id,
        moduleId: devMilestones.moduleId,
        name: devMilestones.name,
        status: devMilestones.status,
        date: devMilestones.date,
        prNumbers: devMilestones.prNumbers,
        sortOrder: devMilestones.sortOrder,
      })
      .from(devMilestones)
      .innerJoin(devModules, eq(devModules.id, devMilestones.moduleId))
      .where(eq(devModules.programId, program.id))
      .orderBy(asc(devMilestones.sortOrder), asc(devMilestones.name)),
    db.select().from(devRoadmaps).where(eq(devRoadmaps.programId, program.id)),
    db
      .select({
        month: devPrs.month,
        repo: devPrs.repo,
        count: sql<number>`count(*)::int`,
      })
      .from(devPrs)
      .where(
        and(eq(devPrs.programId, program.id), eq(devPrs.isPromotion, false)),
      )
      .groupBy(devPrs.month, devPrs.repo),
    db
      .select()
      .from(devLog)
      .where(eq(devLog.programId, program.id))
      .orderBy(desc(devLog.date), desc(devLog.createdAt))
      .limit(200),
  ]);

  const milestonesByModule = new Map<string, typeof milestones>();
  for (const m of milestones) {
    milestonesByModule.set(m.moduleId, [
      ...(milestonesByModule.get(m.moduleId) ?? []),
      m,
    ]);
  }

  const labelByRepo = new Map(program.repos.map((r) => [r.name, r.label]));
  const monthsMap = new Map<string, PrMonthRow>();
  for (const row of prRows) {
    const label = labelByRepo.get(row.repo) ?? row.repo;
    const entry = monthsMap.get(row.month) ?? {
      month: row.month,
      byRepo: {},
      total: 0,
    };
    entry.byRepo[label] = (entry.byRepo[label] ?? 0) + row.count;
    entry.total += row.count;
    monthsMap.set(row.month, entry);
  }
  const prsByMonth = [...monthsMap.values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  );
  const totalPrs = prsByMonth.reduce((acc, m) => acc + m.total, 0);

  const sortedRoadmaps = [...roadmaps].sort((a, b) =>
    compareRoadmapCodes(a.code, b.code),
  );

  const allMilestones = milestones.length;
  const inProd = milestones.filter((m) => m.status === "en_prod").length;
  const blocked = milestones.filter((m) => m.status === "bloqueado").length;

  return {
    program,
    modules: modules.map((m) => ({
      ...m,
      milestones: milestonesByModule.get(m.id) ?? [],
    })),
    roadmaps: sortedRoadmaps,
    prsByMonth,
    log,
    summary: {
      totalPrs,
      roadmaps: roadmaps.length,
      roadmapsInProd: roadmaps.filter((r) => r.status === "en_prod").length,
      modules: modules.length,
      milestones: allMilestones,
      milestonesInProd: inProd,
      milestonesBlocked: blocked,
      avgProgress: modules.length
        ? Math.round(
            modules.reduce((acc, m) => acc + m.progress, 0) / modules.length,
          )
        : 0,
      repos: program.repos.map((r) => r.label),
    },
  };
}

export type DevTracking = NonNullable<
  Awaited<ReturnType<typeof getDevTracking>>
>;
