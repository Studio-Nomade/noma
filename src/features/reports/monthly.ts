import "server-only";

import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clientRequests,
  monthlyReports,
  requestDeliveries,
  type MonthlyReportConfig,
} from "@/db/schema";
import {
  createMyTask,
  listProjectTasksForReport,
  listTaskStories,
  setNumberFieldByName,
  type AsanaReportTask,
} from "@/features/asana/asana";
import { foldName } from "@/features/asana/custom-fields";
import { localDateParts, toIsoDate } from "@/features/email/dates";
import { createDraft } from "@/features/email/inbox";
import { STUDIO_SENDER_NAME } from "@/features/email/requests";
import {
  listActiveChannels,
  type ResolvedEmailChannel,
} from "@/features/email/store";
import {
  escapeHtml,
  monthlyReportLabel,
  monthlyReportSubject,
  renderMonthlyReportEmail,
} from "@/features/email/templates";
import {
  computeMonthlyMetrics,
  metricsHighlights,
  metricsIndicators,
  monthDate,
  monthKey,
  previousMonth,
  roundsFromComments,
  ROUNDS_FIELD,
  type MonthlyMetrics,
  type ReportMonth,
  type ReportTask,
} from "./metrics";

const PRIORITY_FIELD = "Prioridad";
/** Máximo de tareas cuyas rondas se buscan en comentarios (sin datos de Noma). */
const MAX_STORY_LOOKUPS = 80;

type Channel = ResolvedEmailChannel;

function fieldValues(task: AsanaReportTask, fieldName: string): string[] {
  const wanted = foldName(fieldName);
  const field = task.custom_fields?.find(
    (item) => foldName(item.name ?? "") === wanted,
  );
  if (!field) return [];
  if (field.multi_enum_values?.length) {
    return field.multi_enum_values
      .map((value) => value.name?.trim() ?? "")
      .filter(Boolean);
  }
  const single = field.enum_value?.name ?? field.display_value;
  return single?.trim() ? [single.trim()] : [];
}

function roundsField(task: AsanaReportTask) {
  const field = task.custom_fields?.find(
    (item) => foldName(item.name ?? "") === foldName(ROUNDS_FIELD),
  );
  return field?.number_value ?? null;
}

/** Rondas por tarea desde las entregas que Noma envió (ENTREGA NN). */
async function roundsFromNoma(taskGids: string[]) {
  const map = new Map<string, number>();
  if (!taskGids.length) return map;
  const rows = await db
    .select({
      taskGid: clientRequests.asanaTaskGid,
      rounds: sql<number>`max(${requestDeliveries.round})`,
    })
    .from(requestDeliveries)
    .innerJoin(
      clientRequests,
      eq(clientRequests.id, requestDeliveries.clientRequestId),
    )
    .where(
      and(
        inArray(clientRequests.asanaTaskGid, taskGids),
        isNotNull(clientRequests.asanaTaskGid),
        eq(requestDeliveries.kind, "delivery"),
        eq(requestDeliveries.status, "sent"),
      ),
    )
    .groupBy(clientRequests.asanaTaskGid);
  for (const row of rows) {
    if (row.taskGid && row.rounds) map.set(row.taskGid, Number(row.rounds));
  }
  return map;
}

/**
 * Tareas del informe: de primer nivel (sin los duplicados de Zapier), con
 * rondas desde Noma, el campo «Rondas de entrega» o, en su defecto, los
 * comentarios «Entrega NN» del equipo.
 */
async function loadReportTasks(
  channel: Channel,
  config: MonthlyReportConfig,
  month: ReportMonth,
  deadline: number,
): Promise<{ tasks: ReportTask[]; roundsToSync: Map<string, number> }> {
  const prev = previousMonth(month);
  const since = new Date(Date.UTC(prev.year, prev.month - 1, 1) - 86_400_000);
  const raw = (
    await listProjectTasksForReport(channel.asanaProjectGid, since)
  ).filter((task) => !task.parent?.gid && task.created_at);

  const fromNoma = await roundsFromNoma(raw.map((task) => task.gid));
  const roundsToSync = new Map<string, number>();
  const rounds = new Map<string, number | null>();
  let lookups = 0;
  for (const task of raw) {
    const noma = fromNoma.get(task.gid) ?? null;
    const field = roundsField(task);
    let value = Math.max(noma ?? 0, field ?? 0) || null;
    if (
      !value &&
      task.completed &&
      lookups < MAX_STORY_LOOKUPS &&
      Date.now() < deadline - 10_000
    ) {
      lookups += 1;
      const stories = await listTaskStories(task.gid, 3).catch(() => []);
      value = roundsFromComments(
        stories
          .filter((story) => story.resource_subtype === "comment_added")
          .map((story) => story.text),
      );
    }
    rounds.set(task.gid, value);
    if (value && value !== field) roundsToSync.set(task.gid, value);
  }

  const breakdownField = config.breakdownField?.trim() || null;
  const tasks: ReportTask[] = raw.map((task) => ({
    gid: task.gid,
    name: task.name ?? "",
    createdAt: new Date(task.created_at!),
    completed: Boolean(task.completed),
    dueOn: task.due_on ?? null,
    sectionNames: (task.memberships ?? [])
      .map((membership) => membership.section?.name ?? "")
      .filter(Boolean),
    priority: fieldValues(task, PRIORITY_FIELD)[0] ?? null,
    breakdown: breakdownField ? fieldValues(task, breakdownField) : [],
    rounds: rounds.get(task.gid) ?? null,
  }));
  return { tasks, roundsToSync };
}

function monthLabelLower(month: ReportMonth) {
  return monthlyReportLabel(monthDate(month)).split(" ")[0].toLowerCase();
}

/** Día hábil N del mes siguiente al informado (lun–vie), en ISO. */
function businessDayOf(month: ReportMonth, n: number) {
  const next =
    month.month === 12
      ? { year: month.year + 1, month: 1 }
      : { year: month.year, month: month.month + 1 };
  let count = 0;
  for (let day = 1; day <= 10; day += 1) {
    const date = new Date(Date.UTC(next.year, next.month - 1, day, 12));
    const weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    count += 1;
    if (count === n) {
      return toIsoDate({ year: next.year, month: next.month, day });
    }
  }
  return null;
}

export type MonthlyReportResult = {
  channel: string;
  month: string;
  status: "drafted" | "skipped" | "failed" | "dry_run";
  metrics?: MonthlyMetrics;
  subject?: string;
  draftId?: string;
  taskGid?: string;
  note?: string;
};

/**
 * Arma el informe de un canal: cifras del mes, borrador del correo en la
 * casilla de servicio (desde el alias, plantilla 08, sin enviar) y una tarea
 * en «Mis tareas» del responsable con el checklist (Canva, PDF, envío).
 * Idempotente por canal y mes. `dryRun` solo calcula.
 */
export async function buildMonthlyReport(
  channel: Channel,
  month: ReportMonth,
  options: { dryRun?: boolean; deadline?: number } = {},
): Promise<MonthlyReportResult> {
  const config = channel.monthlyReport;
  const key = monthKey(month);
  if (!config?.enabled) {
    return {
      channel: channel.alias,
      month: key,
      status: "skipped",
      note: "Sin informe mensual.",
    };
  }
  const deadline = options.deadline ?? Date.now() + 240_000;
  const clientLabel = config.clientLabel?.trim() || channel.clientName;

  if (!options.dryRun) {
    const [claimed] = await db
      .insert(monthlyReports)
      .values({ emailChannelId: channel.id, month: key, status: "running" })
      .onConflictDoNothing()
      .returning();
    if (!claimed) {
      const [retry] = await db
        .update(monthlyReports)
        .set({ status: "running", error: null, updatedAt: new Date() })
        .where(
          and(
            eq(monthlyReports.emailChannelId, channel.id),
            eq(monthlyReports.month, key),
            eq(monthlyReports.status, "failed"),
          ),
        )
        .returning();
      if (!retry) {
        return {
          channel: channel.alias,
          month: key,
          status: "skipped",
          note: "Ya existe.",
        };
      }
    }
  }

  try {
    const { tasks, roundsToSync } = await loadReportTasks(
      channel,
      config,
      month,
      deadline,
    );
    const today = toIsoDate(localDateParts(new Date()));
    const metrics = computeMonthlyMetrics(tasks, month, today);
    const prev = previousMonth(month);
    const previous = computeMonthlyMetrics(tasks, prev, today);
    const subject = monthlyReportSubject(clientLabel, monthDate(month));

    if (options.dryRun) {
      return {
        channel: channel.alias,
        month: key,
        status: "dry_run",
        metrics,
        subject,
      };
    }

    const label = monthlyReportLabel(monthDate(month));
    const email = renderMonthlyReportEmail({
      clientName: clientLabel,
      alias: channel.alias,
      service: config.service,
      month: monthDate(month),
      indicators: metricsIndicators(metrics),
      highlights: metricsHighlights(metrics, previous, monthLabelLower(prev)),
      proposal: null,
      attachmentName: `${clientLabel} | Informe de Solicitudes - ${label.split(" ")[0]}.pdf`,
    });
    const draft = await createDraft({
      from: {
        name: `${clientLabel} | ${STUDIO_SENDER_NAME}`,
        email: channel.alias,
      },
      to: config.to,
      cc: config.cc ?? [],
      subject,
      html: email.html,
      text: email.text,
    });

    let taskGid: string | undefined;
    if (config.assigneeGid) {
      const due = businessDayOf(month, 3);
      const task = await createMyTask({
        assigneeGid: config.assigneeGid,
        name: subject,
        dueOn: due,
        htmlNotes: `<body>Noma dejó el <strong>borrador del informe de ${escapeHtml(label)}</strong> en la casilla de servicio, desde ${escapeHtml(channel.alias)}, con las cifras del mes. Falta el PDF de Canva y la propuesta para el mes siguiente.\n\n<strong>Cifras</strong>\n<ul>${metricsIndicators(
          metrics,
        )
          .map(
            (row) =>
              `<li>${escapeHtml(row.label)}: ${escapeHtml(row.value)}${row.detail ? ` (${escapeHtml(row.detail)})` : ""}</li>`,
          )
          .join("")}</ul></body>`,
        subtasks: [
          {
            name: "Actualizar los filtros de Métricas en Asana al mes informado",
            dueOn: businessDayOf(month, 1),
          },
          {
            name: "Actualizar la presentación en Canva (duplicar la del mes anterior)",
            dueOn: businessDayOf(month, 2),
          },
          {
            name: "Exportar el PDF y adjuntarlo al borrador del correo",
            dueOn: due,
          },
          {
            name: "Revisar hallazgos, sumar la propuesta y enviar",
            dueOn: due,
          },
        ],
      });
      taskGid = task.gid;
    }

    // El panel de Métricas promedia el campo «Rondas de entrega»: se
    // completan las tareas cuyas rondas se conocen y el campo no refleja.
    for (const [gid, value] of roundsToSync) {
      if (Date.now() > deadline - 5_000) break;
      await setNumberFieldByName(
        gid,
        channel.asanaProjectGid,
        ROUNDS_FIELD,
        value,
      ).catch(() => false);
    }

    await db
      .update(monthlyReports)
      .set({
        status: "drafted",
        metrics,
        gmailDraftId: draft.draftId,
        asanaTaskGid: taskGid ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(monthlyReports.emailChannelId, channel.id),
          eq(monthlyReports.month, key),
        ),
      );
    return {
      channel: channel.alias,
      month: key,
      status: "drafted",
      metrics,
      subject,
      draftId: draft.draftId,
      taskGid,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 500) : "Error";
    if (!options.dryRun) {
      await db
        .update(monthlyReports)
        .set({ status: "failed", error: message, updatedAt: new Date() })
        .where(
          and(
            eq(monthlyReports.emailChannelId, channel.id),
            eq(monthlyReports.month, key),
          ),
        );
    }
    return {
      channel: channel.alias,
      month: key,
      status: "failed",
      note: message,
    };
  }
}

/** Todos los canales con informe mensual activo (o uno, por alias). */
export async function runMonthlyReports(input: {
  month: ReportMonth;
  alias?: string | null;
  dryRun?: boolean;
  deadline?: number;
}) {
  const channels = (await listActiveChannels()).filter(
    (channel) => !input.alias || channel.alias === input.alias,
  );
  const results: MonthlyReportResult[] = [];
  for (const channel of channels) {
    if (!channel.monthlyReport?.enabled) continue;
    results.push(
      await buildMonthlyReport(channel, input.month, {
        dryRun: input.dryRun,
        deadline: input.deadline,
      }),
    );
  }
  return results;
}
