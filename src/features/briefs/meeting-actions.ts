"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { briefMeetings, briefs, projects, teamMembers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { createCalendarEvent } from "@/features/google/calendar";
import { AREAS } from "@/types/enums";

const meetingSchema = z
  .object({
    projectId: z.string().uuid(),
    title: z.string().trim().min(1, "El título de la reunión es obligatorio."),
    objective: z.string().trim().optional(),
    agenda: z.string().trim().optional(),
    area: z.enum(AREAS, { message: "Selecciona el área principal preliminar." }),
    areas: z.array(z.enum(AREAS)).default([]),
    responsibleId: z
      .string()
      .uuid("Selecciona un responsable comercial.")
      .optional()
      .or(z.literal("")),
    date: z.string().trim().min(1, "La fecha es obligatoria."),
    time: z.string().trim().min(1, "La hora es obligatoria."),
    durationMin: z.number().int().positive().default(45),
    internalParticipantIds: z.array(z.string().uuid()).default([]),
    externalEmails: z.array(z.string().email("Correo externo inválido.")).default([]),
    primaryContact: z
      .object({ name: z.string().optional(), email: z.string().email() })
      .nullable()
      .default(null),
  })
  .refine((d) => !!d.responsibleId, {
    message: "Selecciona un responsable comercial.",
    path: ["responsibleId"],
  })
  .refine((d) => d.primaryContact != null || d.externalEmails.length > 0, {
    message: "Indica un contacto principal o al menos un correo externo.",
    path: ["externalEmails"],
  });

export type ScheduleMeetingInput = z.input<typeof meetingSchema>;

export type ScheduleMeetingData = {
  id: string;
  googleConnected: boolean;
  googleReason?: string;
};

export async function scheduleBriefMeeting(
  raw: ScheduleMeetingInput,
): Promise<ActionResult<ScheduleMeetingData>> {
  try {
    const user = await requireUser();
    const d = meetingSchema.parse(raw);

    // Oportunidad + cliente asociado.
    const [project] = await db
      .select({ id: projects.id, clientId: projects.clientId })
      .from(projects)
      .where(eq(projects.id, d.projectId))
      .limit(1);
    if (!project) return { ok: false, error: "Oportunidad no encontrada." };

    // Participantes internos → {id, name, email} desde team_members.
    let internal: { id: string; name: string; email: string | null }[] = [];
    if (d.internalParticipantIds.length > 0) {
      const rows = await db
        .select({
          id: teamMembers.id,
          name: teamMembers.name,
          email: teamMembers.email,
        })
        .from(teamMembers)
        .orderBy(asc(teamMembers.name));
      internal = rows.filter((r) => d.internalParticipantIds.includes(r.id));
    }

    // Participantes externos: contacto principal + correos sueltos (dedup).
    const externalMap = new Map<string, { name?: string; email: string }>();
    if (d.primaryContact) {
      externalMap.set(d.primaryContact.email.toLowerCase(), {
        name: d.primaryContact.name,
        email: d.primaryContact.email,
      });
    }
    for (const email of d.externalEmails) {
      externalMap.set(email.toLowerCase(), { email });
    }

    // Fecha/hora local → timestamp. La zona precisa se maneja en la Fase 5 (Calendar).
    const startsAt = new Date(`${d.date}T${d.time}:00`);
    if (Number.isNaN(startsAt.getTime())) {
      return { ok: false, error: "Fecha u hora inválida." };
    }

    const [row] = await db
      .insert(briefMeetings)
      .values({
        projectId: d.projectId,
        clientId: project.clientId,
        title: d.title,
        objective: d.objective || null,
        agenda: d.agenda || null,
        area: d.area,
        areas: d.areas.length ? d.areas : [d.area],
        startsAt,
        durationMin: d.durationMin,
        responsibleId: d.responsibleId || null,
        organizerId: user.id,
        organizerEmail: user.email ?? null,
        internalParticipants: internal.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email ?? undefined,
        })),
        externalParticipants: [...externalMap.values()],
        status: "Agendada",
        createdBy: user.id,
      })
      .returning({ id: briefMeetings.id });

    // Crea el evento en Google Calendar (+ Meet). Degrada con elegancia si el
    // usuario aún no concedió el scope: la reunión queda guardada localmente.
    const attendees = [
      ...internal.map((r) => r.email).filter((e): e is string => !!e),
      ...[...externalMap.values()].map((c) => c.email),
    ];
    const description = [d.objective, d.agenda].filter(Boolean).join("\n\n");
    const gcal = await createCalendarEvent({
      userId: user.id,
      summary: d.title,
      description,
      startsAt,
      durationMin: d.durationMin,
      attendees,
    });
    if (gcal.connected) {
      await db
        .update(briefMeetings)
        .set({
          calendarEventId: gcal.eventId,
          calendarLink: gcal.htmlLink,
          meetLink: gcal.meetLink,
          updatedAt: new Date(),
        })
        .where(eq(briefMeetings.id, row.id));
    }

    // Avanza la oportunidad en el pipeline.
    await db
      .update(projects)
      .set({ commercialStage: "Reunión inicial agendada", updatedAt: new Date() })
      .where(eq(projects.id, d.projectId));

    // Sincroniza el estado del brief (crea el sobre si no existe).
    const [existingBrief] = await db
      .select({ id: briefs.id })
      .from(briefs)
      .where(eq(briefs.projectId, d.projectId))
      .limit(1);
    if (existingBrief) {
      await db
        .update(briefs)
        .set({ status: "Reunión agendada", updatedAt: new Date() })
        .where(eq(briefs.id, existingBrief.id));
    } else {
      await db.insert(briefs).values({
        projectId: d.projectId,
        clientId: project.clientId,
        area: d.area,
        involvedAreas: d.areas.filter((a) => a !== d.area),
        status: "Reunión agendada",
        createdBy: user.id,
      });
    }

    await logActivity({
      entityType: "brief_meeting",
      entityId: row.id,
      action: "meeting_scheduled",
      actorId: user.id,
    });

    revalidatePath(`/projects/${d.projectId}`);
    revalidatePath("/pipeline");
    revalidatePath(`/briefs/${d.projectId}`);
    return {
      ok: true,
      data: {
        id: row.id,
        googleConnected: gcal.connected,
        googleReason: gcal.connected ? undefined : gcal.reason,
      },
    };
  } catch (err) {
    return handleActionError(err, "scheduleBriefMeeting");
  }
}
