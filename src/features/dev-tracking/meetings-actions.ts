"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  clientContacts,
  devLog,
  devMeetingTypes,
  devMeetings,
  devPrograms,
} from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import {
  createCalendarEvent,
  deleteCalendarEvent,
} from "@/features/google/calendar";
import { MEETING_CADENCES } from "./meetings-constants";
import { buildAgenda, operationsMailboxStatus } from "./meetings-queries";

async function programById(programId: string) {
  const [p] = await db
    .select({
      id: devPrograms.id,
      projectId: devPrograms.projectId,
      clientId: devPrograms.clientId,
      name: devPrograms.name,
    })
    .from(devPrograms)
    .where(eq(devPrograms.id, programId))
    .limit(1);
  return p ?? null;
}

// ── Tipos de reunión ─────────────────────────────────────────

const typeSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  programId: z.string().uuid(),
  name: z.string().trim().min(2, "Nombre obligatorio.").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  cadence: z.enum(MEETING_CADENCES),
  weekday: z.coerce.number().int().min(0).max(6).optional().or(z.literal("")),
  timeOfDay: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Hora inválida.")
    .optional()
    .or(z.literal("")),
  durationMin: z.coerce.number().int().min(15).max(240).default(60),
  contactIds: z.array(z.string().uuid()).default([]),
  extraEmails: z.array(z.string().email("Correo inválido.")).default([]),
  agendaTemplate: z.string().trim().max(2000).optional().or(z.literal("")),
  producesBacklog: z.boolean().default(true),
});

export type MeetingTypeInput = z.input<typeof typeSchema>;

export async function saveMeetingType(
  raw: MeetingTypeInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const d = typeSchema.parse(raw);
    const program = await programById(d.programId);
    if (!program) return { ok: false, error: "Programa no encontrado." };
    const values = {
      programId: program.id,
      name: d.name,
      description: d.description || null,
      cadence: d.cadence,
      weekday: d.weekday === "" || d.weekday === undefined ? null : d.weekday,
      timeOfDay: d.timeOfDay || null,
      durationMin: d.durationMin,
      contactIds: d.contactIds,
      extraEmails: d.extraEmails.map((e) => e.toLowerCase()),
      agendaTemplate: d.agendaTemplate || null,
      producesBacklog: d.producesBacklog,
      updatedAt: new Date(),
    };
    let id: string;
    if (d.id) {
      const [row] = await db
        .update(devMeetingTypes)
        .set(values)
        .where(
          and(
            eq(devMeetingTypes.id, d.id),
            eq(devMeetingTypes.programId, program.id),
          ),
        )
        .returning({ id: devMeetingTypes.id });
      if (!row) return { ok: false, error: "Tipo de reunión no encontrado." };
      id = row.id;
    } else {
      const [row] = await db
        .insert(devMeetingTypes)
        .values({ ...values, createdBy: user.id })
        .returning({ id: devMeetingTypes.id });
      id = row.id;
    }
    revalidatePath(`/projects/${program.projectId}/seguimiento`);
    return { ok: true, data: { id } };
  } catch (err) {
    return handleActionError(err, "dev-tracking/saveMeetingType");
  }
}

export async function archiveMeetingType(id: string): Promise<ActionResult> {
  try {
    await requireUser();
    const [row] = await db
      .update(devMeetingTypes)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(devMeetingTypes.id, id))
      .returning({ programId: devMeetingTypes.programId });
    if (!row) return { ok: false, error: "Tipo de reunión no encontrado." };
    const program = await programById(row.programId);
    if (program) revalidatePath(`/projects/${program.projectId}/seguimiento`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "dev-tracking/archiveMeetingType");
  }
}

// ── Agendar ──────────────────────────────────────────────────

const scheduleSchema = z.object({
  programId: z.string().uuid(),
  meetingTypeId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(2, "Título obligatorio.").max(160),
  date: z.string().date(),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida."),
  durationMin: z.coerce.number().int().min(15).max(240).default(60),
  contactIds: z.array(z.string().uuid()).default([]),
  extraEmails: z.array(z.string().email("Correo inválido.")).default([]),
  includeAgenda: z.boolean().default(true),
  agendaExtra: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ScheduleDevMeetingInput = z.input<typeof scheduleSchema>;

export type ScheduleDevMeetingData = {
  id: string;
  calendarCreated: boolean;
  reason?: string;
  meetLink?: string | null;
};

/** Convierte fecha + hora de America/Santiago a instante UTC. */
function santiagoToDate(date: string, time: string): Date {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
  );
  const offset = asLocal - guess.getTime();
  return new Date(guess.getTime() - offset);
}

export async function scheduleDevMeeting(
  raw: ScheduleDevMeetingInput,
): Promise<ActionResult<ScheduleDevMeetingData>> {
  try {
    const user = await requireUser();
    const d = scheduleSchema.parse(raw);
    const program = await programById(d.programId);
    if (!program) return { ok: false, error: "Programa no encontrado." };

    let type: typeof devMeetingTypes.$inferSelect | null = null;
    if (d.meetingTypeId) {
      const [t] = await db
        .select()
        .from(devMeetingTypes)
        .where(
          and(
            eq(devMeetingTypes.id, d.meetingTypeId),
            eq(devMeetingTypes.programId, program.id),
          ),
        )
        .limit(1);
      type = t ?? null;
    }

    const contactRows = d.contactIds.length
      ? await db
          .select({
            id: clientContacts.id,
            name: clientContacts.name,
            email: clientContacts.email,
          })
          .from(clientContacts)
          .where(
            and(
              eq(clientContacts.clientId, program.clientId),
              inArray(clientContacts.id, d.contactIds),
            ),
          )
      : [];
    const attendeeMap = new Map<string, { name?: string; email: string }>();
    for (const c of contactRows) {
      attendeeMap.set(c.email.toLowerCase(), {
        name: c.name ?? undefined,
        email: c.email,
      });
    }
    for (const e of d.extraEmails) {
      attendeeMap.set(e.toLowerCase(), { email: e.toLowerCase() });
    }
    // Quien agenda siempre va invitado (la casilla organiza, la persona asiste).
    if (user.email) {
      attendeeMap.set(user.email.toLowerCase(), {
        name: user.user_metadata?.full_name as string | undefined,
        email: user.email,
      });
    }
    const attendees = [...attendeeMap.values()];
    if (attendees.length === 0) {
      return { ok: false, error: "Agrega al menos un asistente." };
    }

    const startsAt = santiagoToDate(d.date, d.time);
    if (Number.isNaN(startsAt.getTime())) {
      return { ok: false, error: "Fecha u hora inválida." };
    }

    const agendaBody = d.includeAgenda
      ? await buildAgenda(program.id, type?.agendaTemplate)
      : (type?.agendaTemplate ?? "");
    const agenda = [agendaBody, d.agendaExtra].filter(Boolean).join("\n\n");

    const mailbox = await operationsMailboxStatus();

    const [row] = await db
      .insert(devMeetings)
      .values({
        programId: program.id,
        meetingTypeId: type?.id ?? null,
        title: d.title,
        startsAt,
        durationMin: d.durationMin,
        attendees,
        agenda: agenda || null,
        organizerEmail: mailbox.mailbox,
        status: "agendada",
        createdBy: user.id,
      })
      .returning({ id: devMeetings.id });

    let calendarCreated = false;
    let reason: string | undefined;
    let meetLink: string | null | undefined;
    if (!mailbox.connected || !mailbox.userId) {
      reason = mailbox.reason ?? "La casilla de operaciones no está conectada.";
    } else {
      const gcal = await createCalendarEvent({
        userId: mailbox.userId,
        summary: d.title,
        description: agenda || undefined,
        startsAt,
        durationMin: d.durationMin,
        attendees: attendees.map((a) => a.email),
      });
      if (gcal.connected) {
        calendarCreated = true;
        meetLink = gcal.meetLink;
        await db
          .update(devMeetings)
          .set({
            calendarEventId: gcal.eventId,
            calendarLink: gcal.htmlLink,
            meetLink: gcal.meetLink,
            updatedAt: new Date(),
          })
          .where(eq(devMeetings.id, row.id));
      } else {
        reason = gcal.reason;
      }
    }

    await db
      .insert(devLog)
      .values({
        programId: program.id,
        date: new Intl.DateTimeFormat("sv-SE", {
          timeZone: "America/Santiago",
        }).format(new Date()),
        text: `Reunión agendada: ${d.title} (${d.date} ${d.time})${calendarCreated ? "" : " · sin evento en Calendar"}`,
        source: "manual",
        createdBy: user.id,
      })
      .onConflictDoNothing();
    await logActivity({
      entityType: "dev_meeting",
      entityId: row.id,
      action: calendarCreated ? "scheduled_calendar" : "scheduled_local",
      actorId: user.id,
    });
    revalidatePath(`/projects/${program.projectId}/seguimiento`);
    return {
      ok: true,
      data: { id: row.id, calendarCreated, reason, meetLink },
    };
  } catch (err) {
    return handleActionError(err, "dev-tracking/scheduleDevMeeting");
  }
}

export async function cancelDevMeeting(
  id: string,
): Promise<ActionResult<{ calendarCancelled: boolean; reason?: string }>> {
  try {
    await requireUser();
    const [row] = await db
      .update(devMeetings)
      .set({ status: "cancelada", updatedAt: new Date() })
      .where(eq(devMeetings.id, id))
      .returning({
        programId: devMeetings.programId,
        calendarEventId: devMeetings.calendarEventId,
      });
    if (!row) return { ok: false, error: "Reunión no encontrada." };
    let calendarCancelled = false;
    let reason: string | undefined;
    if (row.calendarEventId) {
      const mailbox = await operationsMailboxStatus();
      if (mailbox.connected && mailbox.userId) {
        const r = await deleteCalendarEvent(
          mailbox.userId,
          row.calendarEventId,
        );
        calendarCancelled = r.connected;
        if (!r.connected) reason = r.reason;
      } else {
        reason = mailbox.reason ?? undefined;
      }
    }
    const program = await programById(row.programId);
    if (program) revalidatePath(`/projects/${program.projectId}/seguimiento`);
    return { ok: true, data: { calendarCancelled, reason } };
  } catch (err) {
    return handleActionError(err, "dev-tracking/cancelDevMeeting");
  }
}

// ── Minuta: procesar ahora y vincular transcripción ──────────

export async function processMeetingNow(
  meetingId: string,
): Promise<
  ActionResult<{ status: string; detail?: string; requests?: number }>
> {
  try {
    const user = await requireUser();
    const [meeting] = await db
      .select({ id: devMeetings.id, programId: devMeetings.programId })
      .from(devMeetings)
      .where(eq(devMeetings.id, meetingId))
      .limit(1);
    if (!meeting) return { ok: false, error: "Reunión no encontrada." };
    // Si la reunión vino de Calendar, refresca primero el evento: Google
    // adjunta ahí las notas de Gemini al terminar.
    const { syncProgramCalendarMeetings } = await import("./calendar-sync");
    await syncProgramCalendarMeetings(meeting.programId).catch(() => null);
    const { runMeetingsDigest } = await import("./minutes");
    const [result] = await runMeetingsDigest({
      deadline: Date.now() + 170_000,
      meetingId,
    });
    const program = await programById(meeting.programId);
    if (program) revalidatePath(`/projects/${program.projectId}/seguimiento`);
    await logActivity({
      entityType: "dev_meeting",
      entityId: meetingId,
      action: `digest:${result?.status ?? "none"}`,
      actorId: user.id,
    });
    if (!result) return { ok: false, error: "No había nada que procesar." };
    return {
      ok: true,
      data: {
        status: result.status,
        detail: result.detail,
        requests: result.requests,
      },
    };
  } catch (err) {
    return handleActionError(err, "dev-tracking/processMeetingNow");
  }
}

const linkSchema = z.object({
  meetingId: z.string().uuid(),
  driveUrlOrId: z.string().trim().min(10),
});

export async function linkTranscript(
  raw: z.input<typeof linkSchema>,
): Promise<ActionResult> {
  try {
    await requireUser();
    const d = linkSchema.parse(raw);
    const { parseDriveId } = await import("@/features/google/drive");
    const fileId = parseDriveId(d.driveUrlOrId);
    if (!fileId)
      return { ok: false, error: "No se reconoció el enlace de Drive." };
    const [row] = await db
      .update(devMeetings)
      .set({
        transcriptFileId: fileId,
        status: "transcrita",
        updatedAt: new Date(),
      })
      .where(eq(devMeetings.id, d.meetingId))
      .returning({ programId: devMeetings.programId });
    if (!row) return { ok: false, error: "Reunión no encontrada." };
    const program = await programById(row.programId);
    if (program) revalidatePath(`/projects/${program.projectId}/seguimiento`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "dev-tracking/linkTranscript");
  }
}

// ── Reuniones creadas fuera de Noma (Calendar) ───────────────

const calendarSchema = z.object({
  programId: z.string().uuid(),
  prefix: z.string().trim().max(120).optional(),
});

export async function importCalendarMeetings(
  raw: z.input<typeof calendarSchema>,
): Promise<
  ActionResult<{ found: number; created: number; transcripts: number }>
> {
  try {
    const user = await requireUser();
    const d = calendarSchema.parse(raw);
    const program = await programById(d.programId);
    if (!program) return { ok: false, error: "Programa no encontrado." };
    if (d.prefix !== undefined) {
      await db
        .update(devPrograms)
        .set({ calendarTitlePrefix: d.prefix || null, updatedAt: new Date() })
        .where(eq(devPrograms.id, program.id));
    }
    const { syncProgramCalendarMeetings } = await import("./calendar-sync");
    const r = await syncProgramCalendarMeetings(program.id);
    if (!r.ok)
      return { ok: false, error: r.reason ?? "No se pudo leer Calendar." };
    await logActivity({
      entityType: "dev_program",
      entityId: program.id,
      action: `calendar_sync:${r.created}`,
      actorId: user.id,
    });
    revalidatePath(`/projects/${program.projectId}/seguimiento`);
    return {
      ok: true,
      data: { found: r.found, created: r.created, transcripts: r.transcripts },
    };
  } catch (err) {
    return handleActionError(err, "dev-tracking/importCalendarMeetings");
  }
}
