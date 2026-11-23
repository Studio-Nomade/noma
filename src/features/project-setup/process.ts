import "server-only";

import {
  createTask,
  listProjectOpenTasks,
  listTaskStories,
  listWorkspaceProjects,
  resolveBotUserGid,
  setProjectHtmlNotes,
  setTaskCompleted,
  type AsanaProjectInfo,
} from "@/features/asana/asana";
import { notifyTeamEvent } from "@/features/bot/notify";
import { escapeHtml } from "@/features/email/templates";
import { findOrCreateFolder } from "./drive-write";
import {
  SETUP_MARK,
  areaForTeam,
  clientFolderName,
  decideChannel,
  parseChannelAnswer,
  parseProjectName,
  projectChannelName,
  projectFolderName,
  type SlackChannel,
} from "./rules";
import {
  createChannel,
  inviteToChannel,
  joinChannel,
  listChannels,
  postToChannel,
  slackBotConfigured,
  userIdByEmail,
} from "./slack-bot";
import { linkProjectToChannel } from "@/features/slack-notify/links";
import { ensureLinkWebhooks } from "@/features/slack-notify/webhooks";

/** Tarea que Noma crea cuando el cliente ya tiene otro canal. */
export const CHANNEL_DECISION_TASK = "Noma · ¿Qué canal de Slack usamos?";

/** Solo proyectos creados desde la puesta en marcha (no los históricos). */
function setupSince(): Date {
  const raw = process.env.NOMA_PROJECT_SETUP_SINCE?.trim();
  const date = raw ? new Date(raw) : new Date("2026-11-24T03:00:00Z");
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function plainText(html: string | undefined) {
  return (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function link(url: string, label: string) {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}

/** Agrega líneas al final de la descripción y quita la línea «por definir». */
function withLines(
  html: string | undefined,
  lines: string[],
  dropPending: boolean,
) {
  let body = (html ?? "").trim();
  if (!body.startsWith("<body>")) body = "<body></body>";
  if (dropPending) {
    body = body.replace(
      new RegExp(`[^\\n<]*${SETUP_MARK.pending}[^\\n]*\\n?`, "g"),
      "",
    );
  }
  return body.replace(/<\/body>\s*$/, `\n${lines.join("\n")}</body>`);
}

export type ProjectSetupResult = {
  project: string;
  folder?: string;
  channel?: string;
  pending?: boolean;
  error?: string;
};

/**
 * Prepara los proyectos nuevos de Asana (reemplaza el Zap «Crear Canal y
 * Carpeta en Drive»). Idempotente: las marcas «Noma · …» en la descripción del
 * proyecto dicen qué ya está hecho. Lo llama el cron de Vercel cada 10 minutos.
 */
export async function processNewProjects({
  deadline = Date.now() + 45_000,
}: { deadline?: number } = {}): Promise<ProjectSetupResult[]> {
  const since = setupSince();
  const projects = (await listWorkspaceProjects()).filter(
    (project) =>
      project.created_at &&
      new Date(project.created_at) >= since &&
      areaForTeam(project.team?.name),
  );
  const results: ProjectSetupResult[] = [];
  let channels: SlackChannel[] | null = null;
  let botUserGid: string | null = null;

  for (const project of projects) {
    if (Date.now() > deadline) break;
    const text = plainText(project.html_notes);
    const folderDone = text.includes(SETUP_MARK.folder);
    const channelDone =
      text.includes(SETUP_MARK.channel) && !text.includes(SETUP_MARK.pending);
    if (folderDone && channelDone) continue;

    const result: ProjectSetupResult = { project: project.name };
    results.push(result);
    try {
      const parsed = parseProjectName(project.name);
      if (!parsed) {
        if (!text.includes(SETUP_MARK.badName)) {
          await setProjectHtmlNotes(
            project.gid,
            withLines(
              project.html_notes,
              [
                `<em>${escapeHtml(`${SETUP_MARK.badName} renombra el proyecto como «Cliente | Proyecto» para que Noma cree la carpeta en Drive y el canal de Slack.`)}</em>`,
              ],
              false,
            ),
          );
        }
        result.error = "nombre sin «Cliente | Proyecto»";
        continue;
      }
      const area = areaForTeam(project.team?.name)!;
      const lines: string[] = [];
      let folderUrl: string | null = null;

      // 1) Drive: carpeta del cliente (se reutiliza) y subcarpeta del proyecto.
      if (!folderDone) {
        const client = await findOrCreateFolder({
          driveId: area.driveId,
          parentId: area.driveId,
          name: clientFolderName(parsed.client),
        });
        const folder = await findOrCreateFolder({
          driveId: area.driveId,
          parentId: client.id,
          name: projectFolderName(
            new Date(project.created_at ?? Date.now()),
            parsed.project,
          ),
        });
        folderUrl = folder.url;
        result.folder = `${client.name}/${folder.name}`;
        lines.push(
          `<strong>${escapeHtml(SETUP_MARK.folder)}</strong> ${link(folder.url, `${client.name} / ${folder.name}`)}`,
        );
      }

      // 2) Slack: canal del proyecto (sin token de bot, queda para después).
      let dropPending = false;
      if (!channelDone && slackBotConfigured()) {
        channels ??= await listChannels();
        const resolved = await resolveChannel({
          project,
          parsed,
          channels,
          pendingAsked: text.includes(SETUP_MARK.pending),
          botUserGid: (botUserGid ??= await resolveBotUserGid()),
        });
        if (resolved.kind === "pending") {
          if (!text.includes(SETUP_MARK.pending)) {
            lines.push(
              `<em>${escapeHtml(`${SETUP_MARK.pending} el cliente ya tiene canal. Responde en la tarea «${CHANNEL_DECISION_TASK}» con «CANAL NUEVO» o «CANAL #nombre».`)}</em>`,
            );
          }
          result.pending = true;
        } else if (resolved.kind === "done") {
          dropPending = text.includes(SETUP_MARK.pending);
          result.channel = resolved.channel.name;
          lines.push(
            `<strong>${escapeHtml(SETUP_MARK.channel)}</strong> #${escapeHtml(resolved.channel.name)}`,
          );
          // El canal queda vinculado a los avisos de Asana del proyecto (bot
          // Noma, hilo por tarea); el webhook lo registra ensureLinkWebhooks.
          await linkProjectToChannel({
            asanaProjectGid: project.gid,
            asanaProjectName: project.name,
            slackChannelId: resolved.channel.id,
            slackChannelName: resolved.channel.name,
          });
          await ensureLinkWebhooks({ projectGid: project.gid }).catch((error) =>
            console.error("[project-setup:webhook]", error),
          );
          await postToChannel(
            resolved.channel.id,
            [
              `📁 Proyecto *${parsed.client} | ${parsed.project}*`,
              project.permalink_url ? `Asana: ${project.permalink_url}` : null,
              folderUrl ? `Carpeta en Drive: ${folderUrl}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
          ).catch((error) => console.error("[project-setup:post]", error));
        }
      }

      if (lines.length || dropPending) {
        await setProjectHtmlNotes(
          project.gid,
          withLines(project.html_notes, lines, dropPending),
        );
      }
    } catch (error) {
      result.error =
        error instanceof Error ? error.message.slice(0, 300) : "error";
      console.error("[project-setup]", project.gid, error);
    }
  }
  return results;
}

async function resolveChannel(input: {
  project: AsanaProjectInfo;
  parsed: { client: string; project: string };
  channels: SlackChannel[];
  pendingAsked: boolean;
  botUserGid: string;
}): Promise<{ kind: "done"; channel: SlackChannel } | { kind: "pending" }> {
  const { project, parsed, channels } = input;

  // Ya se preguntó: se lee la respuesta en la tarea de decisión.
  if (input.pendingAsked) {
    const task = (await listProjectOpenTasks(project.gid)).find(
      (item) => item.name === CHANNEL_DECISION_TASK,
    );
    if (!task) return { kind: "pending" };
    const answer = (await listTaskStories(task.gid))
      .filter(
        (story) =>
          story.resource_subtype === "comment_added" &&
          story.created_by?.gid !== input.botUserGid,
      )
      .map((story) => parseChannelAnswer(story.text))
      .filter((value) => value !== null)
      .at(-1);
    if (!answer) return { kind: "pending" };
    let channel: SlackChannel | null;
    if (answer.kind === "existing") {
      channel = channels.find((item) => item.name === answer.name) ?? null;
      if (!channel) return { kind: "pending" };
      await joinChannel(channel.id);
    } else {
      channel = await openNewChannel(project, parsed, channels);
    }
    await setTaskCompleted(task.gid, true).catch(() => undefined);
    return { kind: "done", channel };
  }

  const decision = decideChannel({ channels, ...parsed });
  if (decision.action === "use") {
    await joinChannel(decision.channel.id);
    return { kind: "done", channel: decision.channel };
  }
  if (decision.action === "create") {
    return {
      kind: "done",
      channel: await openNewChannel(project, parsed, channels),
    };
  }
  // El cliente ya tiene otro canal: pregunta al equipo.
  await createTask({
    projectGid: project.gid,
    name: CHANNEL_DECISION_TASK,
    htmlNotes: `<body>${escapeHtml(`${parsed.client} ya tiene canal en Slack: ${decision.candidates.map((item) => `#${item.name}`).join(", ")}.`)}
${escapeHtml(`Comenta en esta tarea «CANAL NUEVO» para crear #${decision.name}, o «CANAL #nombre» para usar uno existente. Noma lo deja en la descripción del proyecto y cierra esta tarea.`)}</body>`,
  });
  await notifyTeamEvent({
    text: `Proyecto nuevo: ${parsed.client} | ${parsed.project}`,
    body: `🧭 Proyecto nuevo *${parsed.client} | ${parsed.project}*: el cliente ya tiene ${decision.candidates.map((item) => `#${item.name}`).join(", ")}. ¿Usamos ese canal o creamos #${decision.name}? Respondan en Asana${project.permalink_url ? ` (<${project.permalink_url}|abrir proyecto>)` : ""} con «CANAL NUEVO» o «CANAL #nombre».`,
  }).catch(() => undefined);
  return { kind: "pending" };
}

/** Crea el canal del proyecto (o usa el existente) e invita al equipo. */
async function openNewChannel(
  project: AsanaProjectInfo,
  parsed: { client: string; project: string },
  channels: SlackChannel[],
): Promise<SlackChannel> {
  const name = projectChannelName(parsed.client, parsed.project);
  const existing = channels.find((item) => item.name === name);
  if (existing) {
    await joinChannel(existing.id);
    return existing;
  }
  const channel = await createChannel(name);
  channels.push(channel);
  const emails = (project.members ?? [])
    .map((member) => member.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));
  const ids = (
    await Promise.all(emails.map((email) => userIdByEmail(email)))
  ).filter((id): id is string => Boolean(id));
  await inviteToChannel(channel.id, ids);
  return channel;
}
