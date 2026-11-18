import "server-only";

import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  devBacklog,
  devMeetings,
  devPackages,
  devQuestions,
} from "@/db/schema";

export async function getBacklogData(programId: string) {
  const [items, meetings, packages, questions] = await Promise.all([
    db
      .select()
      .from(devBacklog)
      .where(eq(devBacklog.programId, programId))
      .orderBy(desc(devBacklog.createdAt), asc(devBacklog.sortOrder))
      .limit(300),
    db
      .select({
        id: devMeetings.id,
        title: devMeetings.title,
        startsAt: devMeetings.startsAt,
      })
      .from(devMeetings)
      .where(eq(devMeetings.programId, programId)),
    db
      .select({
        id: devPackages.id,
        code: devPackages.code,
        title: devPackages.title,
        status: devPackages.status,
        itemIds: devPackages.itemIds,
        createdAt: devPackages.createdAt,
        resultAt: devPackages.resultAt,
      })
      .from(devPackages)
      .where(eq(devPackages.programId, programId))
      .orderBy(desc(devPackages.createdAt))
      .limit(20),
    db
      .select()
      .from(devQuestions)
      .where(eq(devQuestions.programId, programId))
      .orderBy(asc(devQuestions.status), desc(devQuestions.since)),
  ]);
  return { items, meetings, packages, questions };
}

export type BacklogData = Awaited<ReturnType<typeof getBacklogData>>;
