import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { devLog, devMeetings, devPrograms } from "@/db/schema";
import { listCalendarEvents } from "@/features/google/calendar";

import { geminiNotesAttachment, matchesPrefix } from "./calendar-match";
import { operationsMailboxStatus } from "./meetings-queries";

/**
 * Trae al programa las reuniones creadas fuera de Noma: eventos del calendario
 * de la casilla de operaciones (basta con que esté invitada) cuyo título
 * empieza con el prefijo del programa («WD - AppsCinco | Revisión…»).
 *
 * También refresca las reuniones agendadas desde Noma: si Google ya adjuntó al
 * evento el documento de notas de Gemini, lo vincula como transcripción.
 */

const LOOKBACK_DAYS = 21;
const LOOKAHEAD_DAYS = 21;

export type CalendarSyncResult = {
  ok: boolean;
  reason?: string;
  found: number;
  created: number;
  updated: number;
  transcripts: number;
};

export async function syncProgramCalendarMeetings(
  programId: string,
  now = new Date(),
): Promise<CalendarSyncResult> {
  const empty = { found: 0, created: 0, updated: 0, transcripts: 0 };
  const [program] = await db
    .select({
      id: devPrograms.id,
      prefix: devPrograms.calendarTitlePrefix,
    })
    .from(devPrograms)
    .where(eq(devPrograms.id, programId))
    .limit(1);
  if (!program)
    return { ok: false, reason: "Programa no encontrado.", ...empty };

  const mailbox = await operationsMailboxStatus();
  if (!mailbox.connected || !mailbox.userId) {
    return {
      ok: false,
      reason: mailbox.reason ?? "La casilla de operaciones no está conectada.",
      ...empty,
    };
  }

  const from = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  const to = new Date(now.getTime() + LOOKAHEAD_DAYS * 86_400_000);
  const res = await listCalendarEvents(mailbox.userId, from, to);
  if (!res.connected) return { ok: false, reason: res.reason, ...empty };

  const existing = await db
    .select({
      id: devMeetings.id,
      calendarEventId: devMeetings.calendarEventId,
      status: devMeetings.status,
      transcriptFileId: devMeetings.transcriptFileId,
    })
    .from(devMeetings)
    .where(
      and(
        eq(devMeetings.programId, program.id),
        isNotNull(devMeetings.calendarEventId),
      ),
    );
  const byEvent = new Map(existing.map((m) => [m.calendarEventId, m]));

  const result = { ok: true, ...empty };
  for (const event of res.events) {
    if (event.allDay) continue;
    const known = byEvent.get(event.id);
    const matches = program.prefix
      ? matchesPrefix(event.summary, program.prefix)
      : false;
    if (!known && !matches) continue;
    result.found++;

    const startsAt = new Date(event.startsAt);
    const endsAt = new Date(event.endsAt);
    const durationMin = Math.max(
      15,
      Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000) || 60,
    );
    const ended = endsAt.getTime() <= now.getTime();
    const notes = geminiNotesAttachment(event);

    if (known) {
      const patch: Partial<typeof devMeetings.$inferInsert> = {};
      if (notes?.fileId && !known.transcriptFileId) {
        patch.transcriptFileId = notes.fileId;
        if (["agendada", "realizada"].includes(known.status)) {
          patch.status = "transcrita";
        }
        result.transcripts++;
      } else if (ended && known.status === "agendada") {
        patch.status = "realizada";
      }
      if (Object.keys(patch).length) {
        await db
          .update(devMeetings)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(devMeetings.id, known.id));
        result.updated++;
      }
      continue;
    }

    const [row] = await db
      .insert(devMeetings)
      .values({
        programId: program.id,
        title: event.summary,
        startsAt,
        durationMin,
        attendees: event.attendeeEmails.map((email) => ({ email })),
        organizerEmail: event.organizerEmail ?? null,
        calendarEventId: event.id,
        calendarLink: event.htmlLink,
        meetLink: event.meetLink,
        status:
          notes?.fileId && ended
            ? "transcrita"
            : ended
              ? "realizada"
              : "agendada",
        transcriptFileId: notes?.fileId ?? null,
        source: "calendar",
      })
      .onConflictDoNothing()
      .returning({ id: devMeetings.id });
    if (row) {
      result.created++;
      if (notes?.fileId) result.transcripts++;
      await db
        .insert(devLog)
        .values({
          programId: program.id,
          date: new Intl.DateTimeFormat("sv-SE", {
            timeZone: "America/Santiago",
          }).format(startsAt),
          text: `Reunión traída de Calendar: ${event.summary}`,
          source: "manual",
        })
        .onConflictDoNothing();
    }
  }
  return result;
}

/**
 * Todos los programas (para el cron): los que tienen prefijo traen reuniones
 * nuevas; todos refrescan las ya vinculadas (estado y notas de Gemini).
 */
export async function syncAllCalendarMeetings() {
  const programs = await db.select({ id: devPrograms.id }).from(devPrograms);
  const results: (CalendarSyncResult & { programId: string })[] = [];
  for (const p of programs) {
    results.push({
      programId: p.id,
      ...(await syncProgramCalendarMeetings(p.id)),
    });
  }
  return results;
}
