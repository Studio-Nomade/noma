"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  clients,
  devBacklog,
  devLog,
  devMeetingMinutes,
  devMeetings,
  devPackages,
  devPrograms,
  devQuestions,
  devRoadmaps,
} from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import {
  addTaskToSection,
  createTask,
  ensureEnumOption,
  ensureSectionByName,
  resolveCustomFieldValues,
  setTaskCustomFields,
} from "@/features/asana/asana";
import {
  BACKLOG_AREAS,
  BACKLOG_DESTINATIONS,
  BACKLOG_ENVIRONMENTS,
  BACKLOG_PRIORITIES,
  BACKLOG_TYPES,
} from "./minutes-schema";
import { buildPackageYaml } from "./package-yaml";
import { reserveRoadmapCode } from "./roadmap-numbering";

function todayLocal() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
  }).format(new Date());
}

async function programOfItem(itemId: string) {
  const [row] = await db
    .select({
      item: devBacklog,
      programId: devPrograms.id,
      projectId: devPrograms.projectId,
      asanaProjectGid: devPrograms.asanaProjectGid,
      programName: devPrograms.name,
    })
    .from(devBacklog)
    .innerJoin(devPrograms, eq(devPrograms.id, devBacklog.programId))
    .where(eq(devBacklog.id, itemId))
    .limit(1);
  return row ?? null;
}

// ── Editar / aprobar / descartar ─────────────────────────────

const editSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  detail: z.string().trim().max(4000).optional().or(z.literal("")),
  area: z.enum(BACKLOG_AREAS).optional().or(z.literal("")),
  type: z.enum(BACKLOG_TYPES).optional().or(z.literal("")),
  environment: z.enum(BACKLOG_ENVIRONMENTS).optional().or(z.literal("")),
  priority: z.enum(BACKLOG_PRIORITIES),
  destination: z.enum(BACKLOG_DESTINATIONS).optional().or(z.literal("")),
  roadmapCode: z.string().trim().max(20).optional().or(z.literal("")),
  evidence: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function updateBacklogItem(
  raw: z.input<typeof editSchema>,
): Promise<ActionResult> {
  try {
    await requireUser();
    const d = editSchema.parse(raw);
    const ctx = await programOfItem(d.id);
    if (!ctx) return { ok: false, error: "Solicitud no encontrada." };
    await db
      .update(devBacklog)
      .set({
        title: d.title,
        detail: d.detail || null,
        area: d.area || null,
        type: d.type || null,
        environment: d.environment || null,
        priority: d.priority,
        destination: d.destination || null,
        roadmapCode: d.roadmapCode ? d.roadmapCode.toUpperCase() : null,
        evidence: d.evidence || null,
        updatedAt: new Date(),
      })
      .where(eq(devBacklog.id, d.id));
    revalidatePath(`/projects/${ctx.projectId}/seguimiento`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "dev-tracking/updateBacklogItem");
  }
}

export async function setBacklogStatus(
  ids: string[],
  status: "aprobada" | "descartada" | "propuesta",
): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireUser();
    const clean = z.array(z.string().uuid()).min(1).parse(ids);
    const rows = await db
      .update(devBacklog)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          inArray(devBacklog.id, clean),
          inArray(devBacklog.status, ["propuesta", "aprobada", "descartada"]),
        ),
      )
      .returning({ programId: devBacklog.programId });
    if (rows.length) {
      const [p] = await db
        .select({ projectId: devPrograms.projectId })
        .from(devPrograms)
        .where(eq(devPrograms.id, rows[0].programId))
        .limit(1);
      if (p) revalidatePath(`/projects/${p.projectId}/seguimiento`);
      await logActivity({
        entityType: "dev_backlog",
        action: `${status}:${rows.length}`,
        actorId: user.id,
      });
    }
    return { ok: true, data: { count: rows.length } };
  } catch (err) {
    return handleActionError(err, "dev-tracking/setBacklogStatus");
  }
}

// ── Roadmap nuevo: Noma asigna el siguiente R## / NDes-### ───

export async function assignRoadmapToItem(
  itemId: string,
  kind: "mejora" | "modulo",
): Promise<ActionResult<{ code: string }>> {
  try {
    const user = await requireUser();
    const ctx = await programOfItem(itemId);
    if (!ctx) return { ok: false, error: "Solicitud no encontrada." };
    if (ctx.item.roadmapCode) {
      return { ok: false, error: `Ya tiene roadmap ${ctx.item.roadmapCode}.` };
    }
    const code = await reserveRoadmapCode(ctx.programId, kind);
    const month = todayLocal().slice(0, 7);
    await db.insert(devRoadmaps).values({
      programId: ctx.programId,
      code,
      title: ctx.item.title,
      month,
      status: "pendiente",
      kind,
      createdBy: user.id,
    });
    await db
      .update(devBacklog)
      .set({ roadmapCode: code, destination: "nuevo", updatedAt: new Date() })
      .where(eq(devBacklog.id, itemId));
    await db
      .insert(devLog)
      .values({
        programId: ctx.programId,
        date: todayLocal(),
        text: `Roadmap ${code} asignado a «${ctx.item.title}»`,
        source: "manual",
        createdBy: user.id,
      })
      .onConflictDoNothing();
    revalidatePath(`/projects/${ctx.projectId}/seguimiento`);
    return { ok: true, data: { code } };
  } catch (err) {
    return handleActionError(err, "dev-tracking/assignRoadmapToItem");
  }
}

// ── Enviar a Asana (una tarea por funcionalidad) ─────────────

const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendBacklogToAsana(
  ids: string[],
): Promise<ActionResult<{ created: number; skipped: string[] }>> {
  try {
    const user = await requireUser();
    const clean = z
      .array(z.string().uuid())
      .min(1)
      .max(15, "Envía a Asana de a 15 solicitudes como máximo.")
      .parse(ids);
    const items = await db
      .select()
      .from(devBacklog)
      .where(
        and(inArray(devBacklog.id, clean), eq(devBacklog.status, "aprobada")),
      );
    if (!items.length) {
      return { ok: false, error: "Selecciona solicitudes aprobadas." };
    }
    const [program] = await db
      .select()
      .from(devPrograms)
      .where(eq(devPrograms.id, items[0].programId))
      .limit(1);
    if (!program?.asanaProjectGid) {
      return {
        ok: false,
        error: "El programa no tiene proyecto de Asana configurado.",
      };
    }
    const projectGid = program.asanaProjectGid;
    // Flujo del proyecto: Solicitudes / Inbox → Backlog priorizado → En curso
    // → Validación / QA → Completadas → «<Mes> (cerradas)». Una solicitud
    // aprobada por Sebastián ya está priorizada.
    const section = await ensureSectionByName(projectGid, "Backlog priorizado");
    const today = new Date();
    const monthName = MONTHS_ES[today.getMonth()];
    await ensureEnumOption(projectGid, "Mes de Trabajo", monthName).catch(
      (err) => console.error("[dev-backlog:asana:mes]", err),
    );
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";

    let created = 0;
    const skipped: string[] = [];
    const createdTasks: { itemId: string; taskGid: string }[] = [];
    for (const item of items) {
      try {
        const meetingLink = item.meetingId
          ? `${appUrl}/projects/${program.projectId}/seguimiento/reuniones/${item.meetingId}`
          : null;
        const htmlNotes =
          `<body>` +
          `<strong>${esc(item.code)}</strong>${item.roadmapCode ? ` · ${esc(item.roadmapCode)}` : ""}\n\n` +
          `${esc(item.detail ?? "")}\n\n` +
          (item.raisedBy ? `Planteó: ${esc(item.raisedBy)}\n` : "") +
          (item.evidence ? `Evidencia: ${esc(item.evidence)}\n` : "") +
          (meetingLink
            ? `\nMinuta: <a href="${meetingLink}">${meetingLink}</a>`
            : "") +
          `</body>`;
        const customFields = await resolveCustomFieldValues(projectGid, [
          {
            kind: "enum",
            fields: ["Tipo de solicitud"],
            options: item.type ? [item.type] : [],
          },
          { kind: "enum", fields: ["Prioridad"], options: [item.priority] },
          {
            kind: "enum",
            fields: ["Entorno"],
            options: item.environment ? [item.environment] : [],
          },
          {
            kind: "enum",
            fields: ["Área", "Area"],
            options: item.area ? [item.area] : [],
          },
          { kind: "enum", fields: ["Mes de Trabajo"], options: [monthName] },
          {
            kind: "enum",
            fields: ["¿Ticket Activo?", "Ticket Activo"],
            options: ["Si", "Sí"],
          },
          { kind: "text", fields: ["Roadmap"], value: item.roadmapCode ?? "" },
        ]);
        const task = await createTask({
          projectGid,
          sectionGid: section.gid,
          name: item.roadmapCode
            ? `${item.roadmapCode} · ${item.title}`
            : item.title,
          htmlNotes,
          customFields,
        });
        createdTasks.push({ itemId: item.id, taskGid: task.gid });
        await db
          .update(devBacklog)
          .set({
            status: "en_asana",
            asanaTaskGid: task.gid,
            updatedAt: new Date(),
          })
          .where(eq(devBacklog.id, item.id));
        created++;
      } catch (err) {
        console.error("[dev-backlog:asana]", item.code, err);
        skipped.push(item.code);
      }
    }

    // La regla del tablero fija Estado y mueve de sección al crear. Se espera a
    // que corra (≈20 s) y recién entonces se fijan Estado = Priorizado y la
    // sección, el orden que la regla respeta.
    if (createdTasks.length) {
      await new Promise((resolve) => setTimeout(resolve, 20_000));
      const estado = await resolveCustomFieldValues(projectGid, [
        { kind: "enum", fields: ["Estado"], options: ["Priorizado"] },
      ]);
      for (const t of createdTasks) {
        try {
          await setTaskCustomFields(t.taskGid, estado);
          await addTaskToSection(section.gid, t.taskGid);
        } catch (err) {
          console.error("[dev-backlog:asana:seccion]", t.taskGid, err);
        }
      }
    }
    await db
      .insert(devLog)
      .values({
        programId: program.id,
        date: todayLocal(),
        text: `${created} solicitud(es) creadas en Asana desde el backlog${skipped.length ? ` · sin crear: ${skipped.join(", ")}` : ""}`,
        source: "asana",
        createdBy: user.id,
      })
      .onConflictDoNothing();
    revalidatePath(`/projects/${program.projectId}/seguimiento`);
    return { ok: true, data: { created, skipped } };
  } catch (err) {
    return handleActionError(err, "dev-tracking/sendBacklogToAsana");
  }
}

// ── Paquete para el arquitecto ───────────────────────────────

export async function buildPackageForMeeting(
  meetingId: string,
): Promise<ActionResult<{ code: string; id: string }>> {
  try {
    const user = await requireUser();
    const [meeting] = await db
      .select({
        meeting: devMeetings,
        programId: devPrograms.id,
        projectId: devPrograms.projectId,
        programName: devPrograms.name,
        clientName: clients.companyName,
      })
      .from(devMeetings)
      .innerJoin(devPrograms, eq(devPrograms.id, devMeetings.programId))
      .innerJoin(clients, eq(clients.id, devPrograms.clientId))
      .where(eq(devMeetings.id, meetingId))
      .limit(1);
    if (!meeting) return { ok: false, error: "Reunión no encontrada." };
    const items = await db
      .select()
      .from(devBacklog)
      .where(
        and(
          eq(devBacklog.meetingId, meetingId),
          inArray(devBacklog.status, ["aprobada", "en_asana"]),
        ),
      )
      .orderBy(devBacklog.sortOrder);
    if (!items.length) {
      return {
        ok: false,
        error: "No hay solicitudes aprobadas en esta reunión.",
      };
    }
    const [minutes] = await db
      .select()
      .from(devMeetingMinutes)
      .where(eq(devMeetingMinutes.meetingId, meetingId))
      .limit(1);
    const questions = await db
      .select()
      .from(devQuestions)
      .where(
        and(
          eq(devQuestions.meetingId, meetingId),
          eq(devQuestions.status, "abierta"),
        ),
      );

    const day = todayLocal();
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(devPackages)
      .where(
        and(
          eq(devPackages.programId, meeting.programId),
          sql`${devPackages.code} like ${`PKG-${day}-%`}`,
        ),
      );
    const code = `PKG-${day}-${String(n + 1).padStart(2, "0")}`;
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
    const yaml = buildPackageYaml({
      code,
      origen: "reunion",
      titulo: meeting.meeting.title,
      fecha: meeting.meeting.startsAt.toISOString().slice(0, 10),
      programa: meeting.programName,
      cliente: meeting.clientName,
      participantes: (minutes?.attendees ?? []).map((a) => ({
        nombre: a.name,
        area: a.area,
      })),
      transcripcion: meeting.meeting.transcriptFileId
        ? `https://docs.google.com/document/d/${meeting.meeting.transcriptFileId}`
        : null,
      resumen: minutes?.summary ?? null,
      confirmado_sin_desarrollo: minutes?.confirmedNoDev ?? [],
      solicitudes: items.map((it) => ({
        id: it.code,
        titulo: it.title,
        detalle: it.detail,
        planteada_por: it.raisedBy,
        area: it.area,
        tipo: it.type,
        entorno: it.environment,
        prioridad: it.priority,
        evidencia: it.evidence,
        destino_sugerido: it.destination,
        roadmap: it.roadmapCode,
        dependencias: it.dependencies,
        asana_gid: it.asanaTaskGid,
      })),
      preguntas_abiertas: questions.map((q) => ({
        pregunta: q.question,
        para: q.forWhom,
        desde: q.since,
      })),
      prioridad_confirmada_por_sebastian: true,
      resultado_endpoint: `${appUrl}/api/dev-tracking/${meeting.programId}/resultados`,
    });
    const [pkg] = await db
      .insert(devPackages)
      .values({
        programId: meeting.programId,
        code,
        meetingId,
        origin: "reunion",
        title: meeting.meeting.title,
        itemIds: items.map((i) => i.id),
        yaml,
        status: "armado",
        createdBy: user.id,
      })
      .returning({ id: devPackages.id });
    await db
      .insert(devLog)
      .values({
        programId: meeting.programId,
        date: day,
        text: `Paquete ${code} armado para el arquitecto (${items.length} solicitudes)`,
        source: "manual",
        createdBy: user.id,
      })
      .onConflictDoNothing();
    revalidatePath(`/projects/${meeting.projectId}/seguimiento`);
    return { ok: true, data: { code, id: pkg.id } };
  } catch (err) {
    return handleActionError(err, "dev-tracking/buildPackageForMeeting");
  }
}
