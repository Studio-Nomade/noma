"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
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
      .set({
        status,
        // Volver a propuesta o descartar deshace la agrupación.
        ...(status === "aprobada" ? {} : { groupedAt: null }),
        updatedAt: new Date(),
      })
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
    const ungrouped = items.filter((i) => !i.groupedAt).map((i) => i.code);
    if (ungrouped.length) {
      return {
        ok: false,
        error: `Agrupa primero (roadmap o módulo): ${ungrouped.join(", ")}.`,
      };
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
    const appUrl = appBaseUrl();

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
        if (item.roadmapCode) {
          await db
            .update(devRoadmaps)
            .set({
              asanaTaskGids: sql`array_append(${devRoadmaps.asanaTaskGids}, ${task.gid})`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(devRoadmaps.programId, program.id),
                eq(devRoadmaps.code, item.roadmapCode),
              ),
            );
        }
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

// ── Paquetes para el arquitecto: uno por roadmap / módulo ────

const PRIORITY_ORDER: Record<string, number> = {
  Crítica: 0,
  Alta: 1,
  Media: 2,
  Normal: 3,
};

/**
 * Arma un paquete por cada roadmap (R## o NDes-###) con solicitudes agrupadas
 * que aún no están en un paquete. Las solicitudes van por prioridad; el orden
 * técnico lo decide el arquitecto dentro del paquete.
 */
export async function buildRoadmapPackages(
  programId: string,
): Promise<ActionResult<{ codes: string[] }>> {
  try {
    const user = await requireUser();
    const id = z.string().uuid().parse(programId);
    const [program] = await db
      .select({
        id: devPrograms.id,
        projectId: devPrograms.projectId,
        name: devPrograms.name,
        clientName: clients.companyName,
      })
      .from(devPrograms)
      .innerJoin(clients, eq(clients.id, devPrograms.clientId))
      .where(eq(devPrograms.id, id))
      .limit(1);
    if (!program) return { ok: false, error: "Programa no encontrado." };

    const packed = await db
      .select({ itemIds: devPackages.itemIds })
      .from(devPackages)
      .where(eq(devPackages.programId, program.id));
    const inPackage = new Set(packed.flatMap((p) => p.itemIds));
    const candidates = (
      await db
        .select()
        .from(devBacklog)
        .where(
          and(
            eq(devBacklog.programId, program.id),
            inArray(devBacklog.status, ["aprobada", "en_asana"]),
            isNotNull(devBacklog.groupedAt),
            isNotNull(devBacklog.roadmapCode),
          ),
        )
        .orderBy(devBacklog.createdAt, devBacklog.sortOrder)
    ).filter((it) => !inPackage.has(it.id));
    if (!candidates.length) {
      return {
        ok: false,
        error:
          "No hay solicitudes agrupadas en un roadmap pendientes de empaquetar.",
      };
    }
    const byRoadmap = new Map<string, typeof candidates>();
    for (const it of candidates) {
      const key = it.roadmapCode!;
      byRoadmap.set(key, [...(byRoadmap.get(key) ?? []), it]);
    }
    const roadmaps = await db
      .select()
      .from(devRoadmaps)
      .where(
        and(
          eq(devRoadmaps.programId, program.id),
          inArray(devRoadmaps.code, [...byRoadmap.keys()]),
        ),
      );
    const roadmapByCode = new Map(roadmaps.map((r) => [r.code, r]));
    const meetingIds = [
      ...new Set(candidates.map((c) => c.meetingId).filter(Boolean)),
    ] as string[];
    const [meetings, minutes, questions] = meetingIds.length
      ? await Promise.all([
          db
            .select()
            .from(devMeetings)
            .where(inArray(devMeetings.id, meetingIds)),
          db
            .select()
            .from(devMeetingMinutes)
            .where(inArray(devMeetingMinutes.meetingId, meetingIds)),
          db
            .select()
            .from(devQuestions)
            .where(
              and(
                inArray(devQuestions.meetingId, meetingIds),
                eq(devQuestions.status, "abierta"),
              ),
            ),
        ])
      : [[], [], []];
    const meetingById = new Map(meetings.map((m) => [m.id, m]));
    const minutesByMeeting = new Map(minutes.map((m) => [m.meetingId, m]));

    const day = todayLocal();
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(devPackages)
      .where(
        and(
          eq(devPackages.programId, program.id),
          sql`${devPackages.code} like ${`PKG-${day}-%`}`,
        ),
      );
    let seq = n;
    const appUrl = appBaseUrl();
    const codes: string[] = [];
    for (const [roadmapCode, list] of byRoadmap) {
      const items = [...list].sort(
        (a, b) =>
          (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
      );
      const roadmap = roadmapByCode.get(roadmapCode);
      const mids = [
        ...new Set(items.map((i) => i.meetingId).filter(Boolean)),
      ] as string[];
      const sources = mids
        .map((mid) => meetingById.get(mid))
        .filter((m): m is NonNullable<typeof m> => !!m);
      const first = sources[0];
      const firstMinutes = first ? minutesByMeeting.get(first.id) : undefined;
      seq += 1;
      const code = `PKG-${day}-${String(seq).padStart(2, "0")}`;
      const title = `${roadmapCode} · ${roadmap?.title ?? items[0].title}`;
      const yaml = buildPackageYaml({
        code,
        origen: first ? "reunion" : "manual",
        titulo: title,
        fecha: day,
        programa: program.name,
        cliente: program.clientName,
        roadmap: {
          codigo: roadmapCode,
          titulo: roadmap?.title ?? null,
          tipo:
            roadmap?.kind ??
            (roadmapCode.startsWith("NDes") ? "modulo" : "mejora"),
          reservado_por_noma: true,
        },
        reuniones: sources.map((m) => ({
          titulo: m.title,
          fecha: m.startsAt.toISOString().slice(0, 10),
          transcripcion: m.transcriptFileId
            ? `https://docs.google.com/document/d/${m.transcriptFileId}`
            : null,
        })),
        participantes: (firstMinutes?.attendees ?? []).map((a) => ({
          nombre: a.name,
          area: a.area,
        })),
        transcripcion: first?.transcriptFileId
          ? `https://docs.google.com/document/d/${first.transcriptFileId}`
          : null,
        resumen:
          sources
            .map((m) => {
              const s = minutesByMeeting.get(m.id)?.summary;
              return s && sources.length > 1 ? `${m.title}:\n${s}` : s;
            })
            .filter(Boolean)
            .join("\n\n") || null,
        confirmado_sin_desarrollo: sources.flatMap(
          (m) => minutesByMeeting.get(m.id)?.confirmedNoDev ?? [],
        ),
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
        preguntas_abiertas: questions
          .filter((q) => q.meetingId && mids.includes(q.meetingId))
          .map((q) => ({
            pregunta: q.question,
            para: q.forWhom,
            desde: q.since,
          })),
        prioridad_confirmada_por_sebastian: true,
        resultado_endpoint: `${appUrl}/api/dev-tracking/${program.id}/resultados`,
      });
      await db.insert(devPackages).values({
        programId: program.id,
        code,
        meetingId: first?.id ?? null,
        origin: first ? "reunion" : "manual",
        title,
        itemIds: items.map((i) => i.id),
        yaml,
        status: "armado",
        createdBy: user.id,
      });
      codes.push(code);
    }
    await db
      .insert(devLog)
      .values({
        programId: program.id,
        date: day,
        text: `Paquetes armados para el arquitecto: ${[...byRoadmap.keys()].join(", ")}`,
        source: "manual",
        createdBy: user.id,
      })
      .onConflictDoNothing();
    revalidatePath(`/projects/${program.projectId}/seguimiento`);
    return { ok: true, data: { codes } };
  } catch (err) {
    return handleActionError(err, "dev-tracking/buildRoadmapPackages");
  }
}
