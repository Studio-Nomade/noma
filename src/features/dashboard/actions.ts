"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { briefMeetings, projects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { createCalendarEvent } from "@/features/google/calendar";
import { dateTimeInStudioTimeZone } from "./integrations";

const calendarMeetingSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, "El título es obligatorio.").max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida."),
  durationMin: z.number().int().min(15).max(480),
  attendeeEmails: z.array(z.string().email()).max(30).default([]),
});

export type CalendarMeetingInput = z.input<typeof calendarMeetingSchema>;

export async function scheduleDashboardMeeting(
  raw: CalendarMeetingInput,
): Promise<
  ActionResult<{
    googleConnected: boolean;
    googleReason?: string;
  }>
> {
  try {
    const user = await requireUser();
    const input = calendarMeetingSchema.parse(raw);
    const [project] = await db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        area: projects.area,
        name: projects.name,
      })
      .from(projects)
      .where(eq(projects.id, input.projectId))
      .limit(1);
    if (!project) return { ok: false, error: "Proyecto no encontrado." };

    const startsAt = dateTimeInStudioTimeZone(input.date, input.time);
    if (!startsAt) return { ok: false, error: "Fecha u hora inválida." };

    const attendees = [
      ...new Set(input.attendeeEmails.map((email) => email.toLowerCase())),
    ];
    const [meeting] = await db
      .insert(briefMeetings)
      .values({
        projectId: project.id,
        clientId: project.clientId,
        title: input.title,
        area: project.area,
        areas: [project.area],
        startsAt,
        durationMin: input.durationMin,
        organizerId: user.id,
        organizerEmail: user.email ?? null,
        externalParticipants: attendees.map((email) => ({ email })),
        status: "Agendada",
        createdBy: user.id,
      })
      .returning({ id: briefMeetings.id });

    const google = await createCalendarEvent({
      userId: user.id,
      summary: input.title,
      description: `Proyecto Noma: ${project.name}`,
      startsAt,
      durationMin: input.durationMin,
      attendees,
    });

    if (google.connected) {
      await db
        .update(briefMeetings)
        .set({
          calendarEventId: google.eventId,
          calendarLink: google.htmlLink,
          meetLink: google.meetLink,
          updatedAt: new Date(),
        })
        .where(eq(briefMeetings.id, meeting.id));
    }

    await logActivity({
      entityType: "brief_meeting",
      entityId: meeting.id,
      action: "meeting_scheduled",
      actorId: user.id,
    });

    revalidatePath("/");
    revalidatePath(`/projects/${project.id}`);
    return {
      ok: true,
      data: {
        googleConnected: google.connected,
        googleReason: google.connected ? undefined : google.reason,
      },
    };
  } catch (error) {
    return handleActionError(error, "scheduleDashboardMeeting");
  }
}
