import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientRequests } from "@/db/schema";
import {
  getTaskState,
  setEnumFieldByName,
  taskFieldValue,
  type AsanaStory,
} from "@/features/asana/asana";
import { notifyTeamEvent } from "@/features/bot/notify";
import { requestClosedMessage } from "@/features/bot/team-events";
import { shouldPlanOnAssign } from "./lifecycle-rules";
import { ESTADO_FIELD, ESTADO_PLANNED } from "./requests";
import { getChannel } from "./store";

/**
 * Cambios del equipo en las tareas de los tableros con canal de correo:
 *
 * - `assigned`: al asignar una tarea que sigue en «Por revisar» (o sin
 *   Estado), pasa a «Planificada». No toca tareas ya avanzadas.
 * - `marked_complete`: si la tarea es una solicitud de correo, aviso corto en
 *   el Slack del cliente. El cierre por aprobación del cliente lo hace (y lo
 *   avisa) el bot, cuyas stories nunca llegan aquí.
 */
export type LifecycleOutcome =
  "planned" | "closed_notified" | "skipped_lifecycle";

export async function processLifecycleStory(
  story: AsanaStory,
  options: { projectGid?: string | null } = {},
): Promise<LifecycleOutcome> {
  const taskGid = story.target?.gid;
  if (!taskGid) return "skipped_lifecycle";
  if (story.resource_subtype === "assigned") {
    return planOnAssign(taskGid, options.projectGid ?? null);
  }
  if (story.resource_subtype === "marked_complete") {
    return notifyClosedByTeam(taskGid, story.created_by?.name ?? null);
  }
  return "skipped_lifecycle";
}

async function planOnAssign(
  taskGid: string,
  projectGid: string | null,
): Promise<LifecycleOutcome> {
  const task = await getTaskState(taskGid);
  if (task.completed) return "skipped_lifecycle";
  if (!shouldPlanOnAssign(taskFieldValue(task, ESTADO_FIELD))) {
    return "skipped_lifecycle";
  }
  const project = projectGid ?? task.projects?.[0]?.gid ?? null;
  if (!project) return "skipped_lifecycle";
  const changed = await setEnumFieldByName(
    taskGid,
    project,
    ESTADO_FIELD,
    ESTADO_PLANNED,
  );
  return changed ? "planned" : "skipped_lifecycle";
}

async function notifyClosedByTeam(
  taskGid: string,
  closedBy: string | null,
): Promise<LifecycleOutcome> {
  const request = await db.query.clientRequests.findFirst({
    where: and(
      eq(clientRequests.channel, "email"),
      eq(clientRequests.asanaTaskGid, taskGid),
    ),
  });
  if (!request?.emailChannelId) return "skipped_lifecycle";
  const channel = await getChannel(request.emailChannelId);
  if (!channel) return "skipped_lifecycle";
  await notifyTeamEvent(
    requestClosedMessage({
      folio: request.folio,
      clientName: channel.clientName,
      by: "team",
      closedBy: closedBy?.split(/\s+/).slice(0, 2).join(" ") ?? null,
      asanaUrl: request.asanaUrl,
    }),
    channel.slackWebhookEnv,
  );
  return "closed_notified";
}
