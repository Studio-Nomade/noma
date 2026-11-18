import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { devBacklog, devLog, devPrograms, devRoadmaps } from "@/db/schema";
import {
  addTaskToSection,
  createTask,
  ensureEnumOption,
  ensureSectionByName,
  resolveCustomFieldValues,
  setTaskCustomFields,
} from "@/features/asana/asana";
import { appBaseUrl } from "@/lib/app-url";
import {
  STAGE_ASANA,
  STAGE_LABEL,
  asanaTaskName,
  needsAsanaTask,
  type Stage,
} from "./stages";

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

/** Espera para que la regla del tablero corra sobre las tareas nuevas. */
const BOARD_RULE_WAIT_MS = 20_000;

function todayLocal() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
  }).format(new Date());
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const VERDICT_LABEL: Record<string, string> = {
  bug: "Error",
  requiere_desarrollo: "Requiere desarrollo",
  bloqueada: "Bloqueada",
};

export type AsanaSyncSummary = {
  created: number;
  updated: number;
  skipped: string[];
};

/**
 * Refleja en Asana las solicitudes indicadas:
 * - sin tarea y revisadas por el arquitecto (salvo «ya existe») → crea la
 *   tarea «R76 · título» con hito, veredicto y nota;
 * - con tarea y `stage` → fija Estado, sección y «¿Ticket Activo?».
 * La regla del tablero mueve y cambia el Estado de las tareas nuevas: se
 * espera ~20 s y recién entonces se fijan Estado y sección.
 */
export async function syncItemsToAsana(
  programId: string,
  itemIds: string[],
  opts: { actorId?: string | null; source?: string } = {},
): Promise<AsanaSyncSummary> {
  const summary: AsanaSyncSummary = { created: 0, updated: 0, skipped: [] };
  if (!itemIds.length) return summary;
  const [program] = await db
    .select()
    .from(devPrograms)
    .where(eq(devPrograms.id, programId))
    .limit(1);
  if (!program?.asanaProjectGid) return summary;
  const projectGid = program.asanaProjectGid;
  const items = await db
    .select()
    .from(devBacklog)
    .where(
      and(eq(devBacklog.programId, programId), inArray(devBacklog.id, itemIds)),
    )
    .orderBy(devBacklog.sortOrder);

  const monthName = MONTHS_ES[new Date().getMonth()];
  const appUrl = appBaseUrl();
  const toCreate = items.filter(needsAsanaTask);
  const toUpdate = items.filter(
    (it) => it.asanaTaskGid && it.stage && it.stage in STAGE_ASANA,
  );
  if (toCreate.length) {
    await ensureEnumOption(projectGid, "Mes de Trabajo", monthName).catch(
      (err) => console.error("[dev-asana:mes]", err),
    );
  }

  const created: { taskGid: string; stage: Stage }[] = [];
  for (const item of toCreate) {
    const stage = (item.stage as Stage | null) ?? "priorizado";
    try {
      const section = await ensureSectionByName(
        projectGid,
        STAGE_ASANA[stage].section,
      );
      const meetingLink = item.meetingId
        ? `${appUrl}/projects/${program.projectId}/seguimiento/reuniones/${item.meetingId}`
        : null;
      const htmlNotes =
        `<body>` +
        `<strong>${esc(item.code)}</strong>` +
        (item.roadmapCode ? ` · ${esc(item.roadmapCode)}` : "") +
        (item.milestone ? ` · ${esc(item.milestone)}` : "") +
        `\n\n${esc(item.detail ?? "")}\n\n` +
        (item.verdict
          ? `<strong>Revisión técnica:</strong> ${esc(VERDICT_LABEL[item.verdict] ?? item.verdict)}${item.verdictNote ? `. ${esc(item.verdictNote)}` : ""}\n`
          : "") +
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
          options: STAGE_ASANA[stage].ticketActivo,
        },
        { kind: "text", fields: ["Roadmap"], value: item.roadmapCode ?? "" },
      ]);
      const task = await createTask({
        projectGid,
        sectionGid: section.gid,
        name: asanaTaskName(item.title, item.roadmapCode),
        htmlNotes,
        customFields,
      });
      created.push({ taskGid: task.gid, stage });
      await db
        .update(devBacklog)
        .set({
          asanaTaskGid: task.gid,
          stage,
          // Las aprobadas a mano pasan a «en Asana»; las revisadas siguen
          // «verificada» (el gid ya dice que están en el tablero).
          ...(item.status === "aprobada" ? { status: "en_asana" } : {}),
          updatedAt: new Date(),
        })
        .where(eq(devBacklog.id, item.id));
      if (item.roadmapCode) {
        await db
          .update(devRoadmaps)
          .set({
            asanaTaskGids: sql`array_append(${devRoadmaps.asanaTaskGids}, ${task.gid})`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(devRoadmaps.programId, programId),
              eq(devRoadmaps.code, item.roadmapCode),
            ),
          );
      }
      summary.created++;
    } catch (err) {
      console.error("[dev-asana:crear]", item.code, err);
      summary.skipped.push(item.code);
    }
  }

  async function applyStage(taskGid: string, stage: Stage) {
    const target = STAGE_ASANA[stage];
    const values = await resolveCustomFieldValues(projectGid, [
      { kind: "enum", fields: ["Estado"], options: [target.estado] },
      {
        kind: "enum",
        fields: ["¿Ticket Activo?", "Ticket Activo"],
        options: target.ticketActivo,
      },
    ]);
    await setTaskCustomFields(taskGid, values);
    const section = await ensureSectionByName(projectGid, target.section);
    await addTaskToSection(section.gid, taskGid);
  }

  for (const item of toUpdate) {
    try {
      await applyStage(item.asanaTaskGid!, item.stage as Stage);
      summary.updated++;
    } catch (err) {
      console.error("[dev-asana:estado]", item.code, err);
      summary.skipped.push(item.code);
    }
  }

  if (created.length) {
    await new Promise((resolve) => setTimeout(resolve, BOARD_RULE_WAIT_MS));
    for (const t of created) {
      try {
        await applyStage(t.taskGid, t.stage);
      } catch (err) {
        console.error("[dev-asana:seccion]", t.taskGid, err);
      }
    }
  }

  if (summary.created || summary.updated || summary.skipped.length) {
    const stages = toUpdate
      .map((it) => `${it.code} → ${STAGE_LABEL[it.stage as Stage]}`)
      .join(", ");
    await db
      .insert(devLog)
      .values({
        programId,
        date: todayLocal(),
        text: [
          summary.created
            ? `${summary.created} tarea(s) creadas en Asana${opts.source ? ` (${opts.source})` : ""}`
            : null,
          summary.updated ? `Asana actualizado: ${stages}` : null,
          summary.skipped.length
            ? `sin sincronizar: ${summary.skipped.join(", ")}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        source: "asana",
        createdBy: opts.actorId ?? null,
      })
      .onConflictDoNothing();
  }
  return summary;
}
