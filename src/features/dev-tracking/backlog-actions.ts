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
} from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import {
  BACKLOG_AREAS,
  BACKLOG_DESTINATIONS,
  BACKLOG_ENVIRONMENTS,
  BACKLOG_PRIORITIES,
  BACKLOG_TYPES,
} from "./minutes-schema";
import { buildPackageYaml } from "./package-yaml";
import { syncItemsToAsana } from "./asana-sync";
import { needsAsanaTask } from "./stages";
import { appBaseUrl } from "@/lib/app-url";

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

// ── Asana: reintento manual ──────────────────────────────────
// Lo normal es que Noma cree las tareas al recibir el resultado del
// arquitecto (`/resultados`). Este botón reintenta las que quedaron sin tarea.

export async function sendBacklogToAsana(
  ids: string[],
): Promise<ActionResult<{ created: number; skipped: string[] }>> {
  try {
    const user = await requireUser();
    const clean = z
      .array(z.string().uuid())
      .min(1)
      .max(20, "Envía a Asana de a 20 solicitudes como máximo.")
      .parse(ids);
    const items = await db
      .select({
        id: devBacklog.id,
        programId: devBacklog.programId,
        verdict: devBacklog.verdict,
        asanaTaskGid: devBacklog.asanaTaskGid,
      })
      .from(devBacklog)
      .where(inArray(devBacklog.id, clean));
    const eligible = items.filter(needsAsanaTask);
    if (!eligible.length) {
      return {
        ok: false,
        error:
          "Solo van a Asana las solicitudes revisadas por Claude Code (con veredicto, salvo «ya existe») que aún no tienen tarea.",
      };
    }
    const [program] = await db
      .select({
        id: devPrograms.id,
        projectId: devPrograms.projectId,
        asanaProjectGid: devPrograms.asanaProjectGid,
      })
      .from(devPrograms)
      .where(eq(devPrograms.id, eligible[0].programId))
      .limit(1);
    if (!program?.asanaProjectGid) {
      return {
        ok: false,
        error: "El programa no tiene proyecto de Asana configurado.",
      };
    }
    const r = await syncItemsToAsana(
      program.id,
      eligible.map((i) => i.id),
      { actorId: user.id, source: "manual" },
    );
    revalidatePath(`/projects/${program.projectId}/seguimiento`);
    return { ok: true, data: { created: r.created, skipped: r.skipped } };
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
    const appUrl = appBaseUrl();
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
