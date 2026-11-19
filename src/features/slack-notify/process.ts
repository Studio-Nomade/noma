import "server-only";

import { and, eq } from "drizzle-orm";
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
  asanaHtmlToMrkdwn,
  asanaTaskUrl,
  eventEnabled,
  mentionMessage,
  mentionedUserGids,
  reopenedMessage,
  slackEscape,
  slackMention,
  storyEventKind,
  type SlackEventKind,
  type SlackMessage,
} from "./format";
import { slackUserForAsanaUser, slackUsersForAsanaUsers } from "./identities";
import { postBotMessage, slackBotConfigured } from "./slack-bot";

/** Niveles hacia arriba para encontrar la solicitud raíz de una subtarea. */
const MAX_PARENT_DEPTH = 3;

export type SlackNotifyOutcome =
  | "enviado"
  | "sin_bot"
  | "sin_vinculo"
  | "sin_evento"
  | "evento_apagado"
  | "duplicado"
  | "error";

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

async function buildMessage(
  kind: SlackEventKind,
  story: AsanaStory,
  ctx: Awaited<ReturnType<typeof taskContext>>,
  projectGid: string,
): Promise<SlackMessage | null> {
  const taskRef = {
    name: ctx.task.name ?? "Tarea",
    url: asanaTaskUrl(ctx.task.gid, projectGid),
    parentName: ctx.parentName,
  };
  if (kind === "mention") {
    const gids = mentionedUserGids(story.html_text);
    const slackIds = await slackUsersForAsanaUsers(gids);
    const names = new Map<string, string>();
    for (const m of (story.html_text ?? "").matchAll(
      /<a\b[^>]*data-asana-gid="(\d+)"[^>]*>([\s\S]*?)<\/a>/gi,
    )) {
      names.set(m[1], m[2].replace(/<[^>]+>/g, "").trim());
    }
    return mentionMessage({
      task: taskRef,
      authorName: story.created_by?.name ?? null,
      mentions: gids.map((gid) =>
        slackMention(slackIds.get(gid) ?? null, names.get(gid) ?? null),
      ),
      body: story.html_text
        ? asanaHtmlToMrkdwn(story.html_text, slackIds)
        : slackEscape(story.text ?? ""),
    });
  }
  if (kind === "reopened") {
    const assignee = await getTaskAssignee(ctx.task.gid).catch(() => null);
    const assigneeSlack = assignee
      ? await slackUserForAsanaUser(assignee.gid, { email: assignee.email })
      : null;
    return reopenedMessage({
      task: taskRef,
      byName: story.created_by?.name ?? null,
      state: taskFieldValue(ctx.task, "Estado"),
      assignee: assignee ? slackMention(assigneeSlack, assignee.name) : null,
    });
  }
  return null;
}

/**
 * Lleva una story de Asana (comentario con mención, tarea reabierta) al canal
 * de Slack vinculado al proyecto, como el bot Noma, en el hilo de la tarea.
 * Idempotente por story (Asana reintenta). Nunca lanza.
 */
export async function notifyAsanaStory(input: {
  storyGid: string;
  projectGid: string;
  story?: AsanaStory;
}): Promise<SlackNotifyOutcome> {
  if (!slackBotConfigured()) return "sin_bot";
  const eventKey = `story:${input.storyGid}`;
  let claimed = false;
  let published = false;
  try {
    const link = await activeLinkFor(input.projectGid);
    if (!link) return "sin_vinculo";
    const story = input.story ?? (await getStory(input.storyGid));
    const kind = storyEventKind(story);
    if (!kind) return "sin_evento";
    if (!eventEnabled(link.events, kind)) return "evento_apagado";
    const taskGid = story.target?.gid;
    if (!taskGid) return "sin_evento";

    const [claim] = await db
      .insert(slackNotifyLog)
      .values({ eventKey, slackChannelId: link.slackChannelId })
      .onConflictDoNothing()
      .returning({ eventKey: slackNotifyLog.eventKey });
    if (!claim) return "duplicado";
    claimed = true;

    const ctx = await taskContext(taskGid);
    const message = await buildMessage(kind, story, ctx, input.projectGid);
    if (!message) return "sin_evento";

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
    published = true;
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
      .update(slackNotifyLog)
      .set({ slackTs: posted.ts, slackChannelId: posted.channel })
      .where(eq(slackNotifyLog.eventKey, eventKey));
    await db
      .update(asanaSlackLinks)
      .set({ lastNotifiedAt: new Date() })
      .where(eq(asanaSlackLinks.id, link.id));
    return "enviado";
  } catch (error) {
    console.error("[slack-notify]", input.storyGid, error);
    // Sin publicar, se libera la clave para que un reintento lo envíe.
    // Ya publicado, la clave se queda: un reintento no lo duplica.
    if (claimed && !published) {
      await db
        .delete(slackNotifyLog)
        .where(eq(slackNotifyLog.eventKey, eventKey))
        .catch(() => undefined);
    }
    return "error";
  }
}
