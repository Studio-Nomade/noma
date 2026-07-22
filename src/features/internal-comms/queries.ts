import "server-only";

import { and, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { announcementReads, announcements, teamMembers } from "@/db/schema";

export type AnnouncementFeedItem = Awaited<
  ReturnType<typeof getAnnouncements>
>[number];

export async function getAnnouncements(teamMemberId: string | null) {
  const now = new Date();
  const rows = await db
    .select()
    .from(announcements)
    .where(
      and(
        lte(announcements.publishedAt, now),
        or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now)),
      ),
    )
    .orderBy(desc(announcements.pinned), desc(announcements.publishedAt))
    .limit(200);

  if (rows.length === 0) return [];
  const [authors, reads] = await Promise.all([
    db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        photoUrl: teamMembers.photoUrl,
      })
      .from(teamMembers)
      .where(
        inArray(teamMembers.id, [...new Set(rows.map((row) => row.authorId))]),
      ),
    teamMemberId
      ? db
          .select({ announcementId: announcementReads.announcementId })
          .from(announcementReads)
          .where(
            and(
              eq(announcementReads.teamMemberId, teamMemberId),
              inArray(
                announcementReads.announcementId,
                rows.map((row) => row.id),
              ),
            ),
          )
      : Promise.resolve([]),
  ]);
  const authorMap = new Map(authors.map((author) => [author.id, author]));
  const readIds = new Set(reads.map((read) => read.announcementId));
  return rows.map((row) => ({
    ...row,
    author: authorMap.get(row.authorId) ?? {
      id: row.authorId,
      name: "Studio Nomade",
      photoUrl: null,
    },
    isRead: readIds.has(row.id),
  }));
}

export async function getUpcomingBirthdays() {
  const members = await db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      birthDate: teamMembers.birthDate,
      photoUrl: teamMembers.photoUrl,
      roleTitle: teamMembers.roleTitle,
    })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.status, "Activo"),
        gt(teamMembers.birthDate, "1900-01-01"),
      ),
    );
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return members
    .filter((member): member is typeof member & { birthDate: string } =>
      Boolean(member.birthDate),
    )
    .map((member) => {
      const [, month, day] = member.birthDate.split("-").map(Number);
      let next = new Date(now.getFullYear(), month - 1, day);
      if (next < today) next = new Date(now.getFullYear() + 1, month - 1, day);
      return {
        ...member,
        nextBirthday: next.toISOString(),
        daysUntil: Math.round((next.getTime() - today.getTime()) / 86400000),
      };
    })
    // Solo cumpleaños que vienen: la ventana es hacia adelante. Antes se incluía
    // "cualquiera de este mes", lo que arrastraba los ya pasados con un daysUntil
    // de ~350 y la UI los mostraba como "en 344 días".
    .filter((member) => member.daysUntil <= 45)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
