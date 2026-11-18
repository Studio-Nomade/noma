import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  devBacklog,
  devMeetingMinutes,
  devMeetings,
  devModules,
  devPrograms,
  devQuestions,
} from "@/db/schema";

export async function getMeetingDetail(projectId: string, meetingId: string) {
  const [row] = await db
    .select({
      meeting: devMeetings,
      programId: devPrograms.id,
      programName: devPrograms.name,
    })
    .from(devMeetings)
    .innerJoin(devPrograms, eq(devPrograms.id, devMeetings.programId))
    .where(
      and(eq(devMeetings.id, meetingId), eq(devPrograms.projectId, projectId)),
    )
    .limit(1);
  if (!row) return null;
  const [minutes] = await db
    .select()
    .from(devMeetingMinutes)
    .where(eq(devMeetingMinutes.meetingId, meetingId))
    .limit(1);
  const [items, questions, modules] = await Promise.all([
    db
      .select()
      .from(devBacklog)
      .where(eq(devBacklog.meetingId, meetingId))
      .orderBy(asc(devBacklog.sortOrder)),
    db
      .select()
      .from(devQuestions)
      .where(eq(devQuestions.meetingId, meetingId))
      .orderBy(asc(devQuestions.createdAt)),
    db
      .select({
        id: devModules.id,
        code: devModules.code,
        name: devModules.name,
      })
      .from(devModules)
      .where(eq(devModules.programId, row.programId)),
  ]);
  return {
    meeting: row.meeting,
    programId: row.programId,
    programName: row.programName,
    minutes: minutes ?? null,
    items,
    questions,
    modules,
  };
}

export type MeetingDetail = NonNullable<
  Awaited<ReturnType<typeof getMeetingDetail>>
>;
