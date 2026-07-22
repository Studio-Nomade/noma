import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courseEnrollments, courses, teamMembers } from "@/db/schema";

export async function listCourses(includeInactive: boolean) {
  const query = db.select().from(courses).orderBy(asc(courses.title));
  return includeInactive ? query : query.where(eq(courses.active, true));
}
export async function listTrainingMembers() {
  return db
    .select({ id: teamMembers.id, name: teamMembers.name })
    .from(teamMembers)
    .where(eq(teamMembers.status, "Activo"))
    .orderBy(asc(teamMembers.name));
}
export async function listEnrollments(
  memberId: string | null,
  includeTeam: boolean,
) {
  const rows = await db
    .select({
      id: courseEnrollments.id,
      courseId: courseEnrollments.courseId,
      teamMemberId: courseEnrollments.teamMemberId,
      status: courseEnrollments.status,
      progressPct: courseEnrollments.progressPct,
      certificateUrl: courseEnrollments.certificateUrl,
      notes: courseEnrollments.notes,
      assignedAt: courseEnrollments.assignedAt,
      startedAt: courseEnrollments.startedAt,
      completedAt: courseEnrollments.completedAt,
      courseTitle: courses.title,
      courseUrl: courses.url,
      courseProvider: courses.provider,
      memberName: teamMembers.name,
    })
    .from(courseEnrollments)
    .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
    .innerJoin(teamMembers, eq(courseEnrollments.teamMemberId, teamMembers.id))
    .orderBy(desc(courseEnrollments.assignedAt));
  return {
    mine: memberId ? rows.filter((row) => row.teamMemberId === memberId) : [],
    team: includeTeam ? rows : [],
  };
}
