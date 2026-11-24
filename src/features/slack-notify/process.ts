import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { asanaSlackLinks, slackNotifyLog, slackTaskThreads } from "@/db/schema";
import {
  getStory,
  getTaskAssignee,
  getTaskState,
  taskFieldValue,
  type AsanaStory,
  type AsanaTaskState,
} from "@/features/asana/asana";
import {
  businessHoursFromEnv,
  deferredSendAt,
} from "@/features/email/business-hours";
import { isEmailChannelProject } from "@/features/email/store";
import {
  EMAIL_FLOW_EVENTS,
  GROUP_WINDOW_MS,
  STATE_FIELD,
  asanaHtmlToMrkdwn,
  asanaTaskUrl,
  assignedMessage,
  completedMessage,
  eventEnabled,
  groupedBody,
  mentionMessage,
  mentionedUserGids,
  newTaskMessage,
  reopenedMessage,
  slackEscape,
  slackMention,
  stateChangeMessage,
  storyEventKind,
  type SlackEventKind,
  type SlackMessage,
} from "./format";
import { slackUserForAsanaUser, slackUsersForAsanaUsers } from "./identities";
import {
  postBotMessage,
  slackBotConfigured,
  updateBotMessage,
} from "./slack-bot";

/** Niveles hacia arriba para encontrar la solicitud raíz de una subtarea. */
const MAX_PARENT_DEPTH = 3;

export type SlackNotifyOutcome =
  | "enviado"
  | "agrupado"
  | "programado"
  | "sin_bot"
  | "sin_vinculo"
  | "sin_evento"
  | "evento_apagado"
  | "flujo_correo"
  | "duplicado"
  | "error";

type LinkRow = typeof asanaSlackLinks.$inferSelect;

export async function activeLinkFor(projectGid: string) {
  const [link] = await db
    .select()
    .from(asanaSlackLinks)
    .where(
      and(
        eq(asanaSlackLinks.asanaProjectGid, projectGid),
        eq(asanaSlackLinks.active, true),
      ),
    )
    .limit(1);
  return link ?? null;
}

/** Tarea, su solicitud raíz (para el hilo) y el nombre de la madre directa. */
async function taskContext(taskGid: string) {
  const task = await getTaskState(taskGid);
  let root: AsanaTaskState = task;
  let parentName: string | null = null;
  for (let depth = 0; depth < MAX_PARENT_DEPTH && root.parent?.gid; depth++) {
    root = await getTaskState(root.parent.gid);
    if (depth === 0) parentName = root.name ?? null;
  }
  return { task, rootGid: root.gid, parentName };
}

type TaskContext = Awaited<ReturnType<typeof taskContext>>;

function taskRef(ctx: TaskContext, projectGid: string) {
  return {
    name: ctx.task.name ?? "Tarea",
    url: asanaTaskUrl(ctx.task.gid, projectGid),
    parentName: ctx.parentName,
  };
}

/** Responsable actual de la tarea como mención de Slack (o null). */
async function assigneeMention(taskGid: string) {
  const assignee = await getTaskAssignee(taskGid).catch(() => null);
  if (!assignee) return null;
  const slackId = await slackUserForAsanaUser(assignee.gid, {
    email: assignee.email,
  });
  return slackMention(slackId, assignee.name);
}

/** Nombre corto (nombre y apellido) de quien hizo el cambio. */
function shortName(name: string | null | undefined) {
  return name ? name.split(/\s+/).slice(0, 2).join(" ") : null;
}

async function buildStoryMessage(
  kind: SlackEventKind,
  story: AsanaStory,
  ctx: TaskContext,
  projectGid: string,
): Promise<SlackMessage | null> {
  const task = taskRef(ctx, projectGid);
  const byName = shortName(story.created_by?.name);
  switch (kind) {
    case "mention": {
      const gids = mentionedUserGids(story.html_text);
      const slackIds = await slackUsersForAsanaUsers(gids);
      const names = new Map<string, string>();
      for (const m of (story.html_text ?? "").matchAll(
        /<a\b[^>]*data-asana-gid="(\d+)"[^>]*>([\s\S]*?)<\/a>/gi,
      )) {
        names.set(m[1], m[2].replace(/<[^>]+>/g, "").trim());
      }
      return mentionMessage({
        task,
        authorName: story.created_by?.name ?? null,
        mentions: gids.map((gid) =>
          slackMention(slackIds.get(gid) ?? null, names.get(gid) ?? null),
        ),
        body: story.html_text
          ? asanaHtmlToMrkdwn(story.html_text, slackIds)
          : slackEscape(story.text ?? ""),
      });
    }
    case "reopened":
      return reopenedMessage({
        task,
        byName,
        state: taskFieldValue(ctx.task, STATE_FIELD),
        assignee: await assigneeMention(ctx.task.gid),
      });
    case "state_change":
      return stateChangeMessage({
        task,
        from: story.old_enum_value?.name ?? null,
        to: story.new_enum_value?.name ?? null,
        byName,
        assignee: await assigneeMention(ctx.task.gid),
      });
    case "assigned": {
      const gid = story.assignee?.gid;
      if (!gid) return null;
      const slackId = await slackUserForAsanaUser(gid);
      return assignedMessage({
        task,
        assignee: slackMention(slackId, story.assignee?.name ?? null),
        byName,
        dueOn: ctx.task.due_on ?? null,
      });
    }
    case "completed":
      return completedMessage({ task, byName });
    default:
      return null;
  }
}

/**
 * Publica `message` para la tarea: si en los últimos 60 s ya hubo un aviso de
 * esa misma tarea en el canal, se suma a ese mensaje (chat.update); si no,
 * va en el hilo de la solicitud o abre el hilo.
 */
async function publish(input: {
  link: LinkRow;
  eventKey: string;
  ctx: TaskContext;
  message: SlackMessage;
}): Promise<"enviado" | "agrupado"> {
  const { link, ctx, message } = input;
  const [recent] = await db
    .select()
    .from(slackNotifyLog)
    .where(
      and(
        eq(slackNotifyLog.asanaTaskGid, ctx.task.gid),
        eq(slackNotifyLog.slackChannelId, link.slackChannelId),
        isNotNull(slackNotifyLog.slackTs),
        isNotNull(slackNotifyLog.body),
        gt(slackNotifyLog.createdAt, new Date(Date.now() - GROUP_WINDOW_MS)),
      ),
    )
    .orderBy(desc(slackNotifyLog.createdAt))
    .limit(1);

  if (recent?.slackTs && recent.body) {
    const body = groupedBody(recent.body, message.mrkdwn);
    await updateBotMessage({
      channel: link.slackChannelId,
      ts: recent.slackTs,
      text: message.text,
      mrkdwn: body,
    });
    // El cuerpo agrupado queda en la fila que abrió el mensaje; la del evento
    // nuevo solo registra que ya se publicó (sin cuerpo: no abre otra tanda).
    await db
      .update(slackNotifyLog)
      .set({ body })
      .where(eq(slackNotifyLog.eventKey, recent.eventKey));
    await db
      .update(slackNotifyLog)
      .set({ slackTs: recent.slackTs })
      .where(eq(slackNotifyLog.eventKey, input.eventKey));
    return "agrupado";
  }

  const [thread] = await db
    .select()
    .from(slackTaskThreads)
    .where(eq(slackTaskThreads.asanaTaskGid, ctx.rootGid))
    .limit(1);
  // Si el proyecto cambió de canal, el hilo viejo no sirve: se abre otro.
  const threadTs =
    thread?.slackChannelId === link.slackChannelId ? thread.threadTs : null;
  const posted = await postBotMessage({
    channel: link.slackChannelId,
    text: message.text,
    mrkdwn: message.mrkdwn,
    threadTs,
  });
  await db
    .update(slackNotifyLog)
    .set({
      slackTs: posted.ts,
      slackChannelId: posted.channel,
      body: message.mrkdwn,
    })
    .where(eq(slackNotifyLog.eventKey, input.eventKey));
  if (!threadTs) {
    await db
      .insert(slackTaskThreads)
      .values({
        asanaTaskGid: ctx.rootGid,
        slackChannelId: posted.channel,
        threadTs: posted.ts,
      })
      .onConflictDoUpdate({
        target: slackTaskThreads.asanaTaskGid,
        set: { slackChannelId: posted.channel, threadTs: posted.ts },
      });
  }
  await db
    .update(asanaSlackLinks)
    .set({ lastNotifiedAt: new Date() })
    .where(eq(asanaSlackLinks.id, link.id));
  return "enviado";
}

/**
 * Horario hábil (lun–vie 9:00–18:00 Santiago, sin feriados): fuera de él, el
 * aviso interno queda en cola en su fila del registro y sale a las 08:55 del
 * siguiente día hábil, agrupado por tarea (flushPendingSlackNotices).
 * Devuelve true si quedó en cola.
 */
async function queueIfOffHours(input: {
  eventKey: string;
  ctx: TaskContext;
  message: SlackMessage;
  now?: Date;
}): Promise<boolean> {
  const deliverAt = deferredSendAt(
    input.now ?? new Date(),
    businessHoursFromEnv(),
  );
  if (!deliverAt) return false;
  await db
    .update(slackNotifyLog)
    .set({
      deliverAt,
      payload: {
        text: input.message.text,
        mrkdwn: input.message.mrkdwn,
        rootGid: input.ctx.rootGid,
      },
    })
    .where(eq(slackNotifyLog.eventKey, input.eventKey));
  return true;
}

/**
 * Esqueleto común: vínculo activo, evento encendido, sin repetir lo que avisa
 * el flujo de correo, clave de idempotencia reservada; arma y publica. Nunca
 * lanza.
 */
async function notifyEvent(input: {
  projectGid: string;
  eventKey: string;
  resolve: () => Promise<{ kind: SlackEventKind; taskGid: string } | null>;
  build: (
    kind: SlackEventKind,
    ctx: TaskContext,
  ) => Promise<SlackMessage | null>;
}): Promise<SlackNotifyOutcome> {
  if (!slackBotConfigured()) return "sin_bot";
  let claimed = false;
  let published = false;
  try {
    const link = await activeLinkFor(input.projectGid);
    if (!link) return "sin_vinculo";
    const resolved = await input.resolve();
    if (!resolved) return "sin_evento";
    const { kind, taskGid } = resolved;
    if (!eventEnabled(link.events, kind)) return "evento_apagado";
    // En los proyectos de correo, la solicitud nueva, los cambios de Estado y
    // el cierre los avisa el flujo de solicitudes (postTeamNoticeToThread),
    // con su contenido propio y en el mismo hilo.
    if (
      EMAIL_FLOW_EVENTS.has(kind) &&
      (await isEmailChannelProject(input.projectGid))
    ) {
      return "flujo_correo";
    }

    const [claim] = await db
      .insert(slackNotifyLog)
      .values({
        eventKey: input.eventKey,
        slackChannelId: link.slackChannelId,
        asanaTaskGid: taskGid,
        kind,
      })
      .onConflictDoNothing()
      .returning({ eventKey: slackNotifyLog.eventKey });
    if (!claim) return "duplicado";
    claimed = true;

    const ctx = await taskContext(taskGid);
    const message = await input.build(kind, ctx);
    if (!message) {
      // Nada que publicar (p. ej. asignación sin persona): queda registrado.
      published = true;
      return "sin_evento";
    }
    if (await queueIfOffHours({ eventKey: input.eventKey, ctx, message })) {
      published = true;
      return "programado";
    }
    const outcome = await publish({
      link,
      eventKey: input.eventKey,
      ctx,
      message,
    });
    published = true;
    return outcome;
  } catch (error) {
    console.error("[slack-notify]", input.eventKey, error);
    // Sin publicar, se libera la clave para que un reintento lo envíe. Ya
    // publicado, la clave se queda: un reintento no lo duplica.
    if (claimed && !published) {
      await db
        .delete(slackNotifyLog)
        .where(eq(slackNotifyLog.eventKey, input.eventKey))
        .catch(() => undefined);
    }
    return "error";
  }
}

/**
 * Lleva una story de Asana (mención, reapertura, cambio de Estado,
 * asignación, cierre) al canal de Slack vinculado al proyecto, como el bot
 * Noma. Idempotente por story (Asana reintenta).
 */
export function notifyAsanaStory(input: {
  storyGid: string;
  projectGid: string;
  story?: AsanaStory;
}): Promise<SlackNotifyOutcome> {
  let story: AsanaStory | null = input.story ?? null;
  return notifyEvent({
    projectGid: input.projectGid,
    eventKey: `story:${input.storyGid}`,
    resolve: async () => {
      story ??= await getStory(input.storyGid);
      const kind = storyEventKind(story);
      const taskGid = story.target?.gid;
      return kind && taskGid ? { kind, taskGid } : null;
    },
    build: (kind, ctx) =>
      buildStoryMessage(kind, story!, ctx, input.projectGid),
  });
}

/** Tarea nueva en el proyecto: abre su hilo en el canal vinculado. */
export function notifyNewTask(input: {
  taskGid: string;
  projectGid: string;
}): Promise<SlackNotifyOutcome> {
  return notifyEvent({
    projectGid: input.projectGid,
    eventKey: `task-added:${input.taskGid}`,
    resolve: async () => ({ kind: "new_task", taskGid: input.taskGid }),
    build: async (_kind, ctx) => {
      // Una subtarea que también se agregó al proyecto no abre hilo propio.
      if (ctx.rootGid !== ctx.task.gid) return null;
      return newTaskMessage({
        task: taskRef(ctx, input.projectGid),
        folio: null,
        assignee: await assigneeMention(ctx.task.gid),
        dueOn: ctx.task.due_on ?? null,
        priority: taskFieldValue(ctx.task, "Prioridad"),
      });
    },
  });
}

/**
 * Avisos del flujo de solicitudes (solicitud nueva, entrega, ajustes,
 * aprobación, cierre) como el bot Noma, en el hilo de la solicitud dentro del
 * canal vinculado al proyecto, con la misma agrupación de 60 s. Devuelve
 * false si el proyecto no tiene vínculo activo (o falla): quien llama usa el
 * webhook de Slack de siempre. Nunca lanza.
 */
export async function postTeamNoticeToThread(input: {
  projectGid: string;
  taskGid: string;
  text: string;
  mrkdwn: string;
}): Promise<boolean> {
  if (!slackBotConfigured()) return false;
  const eventKey = `team:${input.taskGid}:${randomUUID()}`;
  let claimed = false;
  try {
    const link = await activeLinkFor(input.projectGid);
    if (!link) return false;
    await db.insert(slackNotifyLog).values({
      eventKey,
      slackChannelId: link.slackChannelId,
      asanaTaskGid: input.taskGid,
      kind: "team",
    });
    claimed = true;
    const ctx = await taskContext(input.taskGid);
    const message = { text: input.text, mrkdwn: input.mrkdwn };
    if (await queueIfOffHours({ eventKey, ctx, message })) return true;
    await publish({ link, eventKey, ctx, message });
    return true;
  } catch (error) {
    console.error("[slack-notify:team]", input.taskGid, error);
    if (claimed) {
      await db
        .delete(slackNotifyLog)
        .where(eq(slackNotifyLog.eventKey, eventKey))
        .catch(() => undefined);
    }
    return false;
  }
}

/**
 * Aviso del equipo que no es de una tarea (p. ej. un correo de remitente no
 * autorizado en el alias del cliente): el bot lo publica como mensaje nuevo
 * en el canal vinculado al proyecto. Fuera del horario hábil queda en cola.
 * false si el proyecto no tiene vínculo activo: quien llama usa el webhook.
 * Nunca lanza.
 */
export async function postTeamNoticeToChannel(input: {
  projectGid: string;
  text: string;
  mrkdwn: string;
}): Promise<boolean> {
  if (!slackBotConfigured()) return false;
  const eventKey = `team-channel:${input.projectGid}:${randomUUID()}`;
  let claimed = false;
  try {
    const link = await activeLinkFor(input.projectGid);
    if (!link) return false;
    await db.insert(slackNotifyLog).values({
      eventKey,
      slackChannelId: link.slackChannelId,
      kind: "team",
    });
    claimed = true;
    const deliverAt = deferredSendAt(new Date(), businessHoursFromEnv());
    if (deliverAt) {
      await db
        .update(slackNotifyLog)
        .set({
          deliverAt,
          payload: { text: input.text, mrkdwn: input.mrkdwn, rootGid: "" },
        })
        .where(eq(slackNotifyLog.eventKey, eventKey));
      return true;
    }
    const posted = await postBotMessage({
      channel: link.slackChannelId,
      text: input.text,
      mrkdwn: input.mrkdwn,
    });
    await db
      .update(slackNotifyLog)
      .set({
        slackTs: posted.ts,
        slackChannelId: posted.channel,
        body: input.mrkdwn,
      })
      .where(eq(slackNotifyLog.eventKey, eventKey));
    return true;
  } catch (error) {
    console.error("[slack-notify:team-channel]", input.projectGid, error);
    if (claimed) {
      await db
        .delete(slackNotifyLog)
        .where(eq(slackNotifyLog.eventKey, eventKey))
        .catch(() => undefined);
    }
    return false;
  }
}

/**
 * Publica los avisos internos que quedaron en cola fuera del horario hábil y
 * cuya hora ya llegó: un mensaje por tarea (sus eventos, en orden), en el
 * hilo de la solicitud. Lo llaman el pg_cron de las 08:55
 * (scheduled-deliveries), el cron slack-notify y cada webhook de Asana.
 */
export async function flushPendingSlackNotices(
  options: { deadline?: number; now?: Date } = {},
) {
  const result = { pending: 0, sent: 0, failed: 0 };
  if (!slackBotConfigured()) return result;
  const now = options.now ?? new Date();
  const rows = await db
    .select()
    .from(slackNotifyLog)
    .where(
      and(
        isNull(slackNotifyLog.slackTs),
        isNotNull(slackNotifyLog.payload),
        lte(slackNotifyLog.deliverAt, now),
      ),
    )
    .orderBy(asc(slackNotifyLog.createdAt))
    .limit(200);
  result.pending = rows.length;

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.slackChannelId || !row.payload) continue;
    const key = `${row.slackChannelId}:${row.asanaTaskGid ?? row.eventKey}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  for (const group of groups.values()) {
    if (options.deadline && Date.now() > options.deadline) break;
    const [first] = group;
    const channel = first.slackChannelId!;
    const rootGid = first.payload!.rootGid;
    const body = group
      .map((row) => row.payload!.mrkdwn)
      .join("\n")
      .slice(0, 2900);
    try {
      const [thread] = await db
        .select()
        .from(slackTaskThreads)
        .where(eq(slackTaskThreads.asanaTaskGid, rootGid))
        .limit(1);
      const threadTs =
        thread?.slackChannelId === channel ? thread.threadTs : null;
      const posted = await postBotMessage({
        channel,
        text: first.payload!.text,
        mrkdwn: body,
        threadTs,
      });
      for (const [index, row] of group.entries()) {
        await db
          .update(slackNotifyLog)
          .set({
            slackTs: posted.ts,
            slackChannelId: posted.channel,
            // El cuerpo agrupado queda en la primera fila (agrupación de 60 s).
            body: index === 0 ? body : null,
            deliverAt: null,
          })
          .where(eq(slackNotifyLog.eventKey, row.eventKey));
      }
      // Los avisos de canal (sin tarea) no abren hilo de tarea.
      if (!threadTs && rootGid) {
        await db
          .insert(slackTaskThreads)
          .values({
            asanaTaskGid: rootGid,
            slackChannelId: posted.channel,
            threadTs: posted.ts,
          })
          .onConflictDoUpdate({
            target: slackTaskThreads.asanaTaskGid,
            set: { slackChannelId: posted.channel, threadTs: posted.ts },
          });
      }
      result.sent += 1;
    } catch (error) {
      // Queda en cola para la siguiente pasada.
      result.failed += 1;
      console.error("[slack-notify:cola]", first.eventKey, error);
    }
  }
  return result;
}
