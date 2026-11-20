import "server-only";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { asanaSlackLinks, asanaWebhooks, slackNotifyLog } from "@/db/schema";
import {
  AsanaApiError,
  createWebhook,
  deleteWebhook,
  getWebhookFilters,
  listModifiedTaskGids,
  listTaskStories,
  listWebhooks,
} from "@/features/asana/asana";
import {
  completeRegistration,
  failRegistration,
  prepareRegistration,
} from "@/features/asana/webhook-store";
import { isEmailChannelProject } from "@/features/email/store";
import { appBaseUrl } from "@/lib/app-url";
import { storyEventKind } from "./format";
import { notifyAsanaStory } from "./process";
import { planWebhook, reconcileSince, webhookTarget } from "./webhook-plan";

type LinkRow = typeof asanaSlackLinks.$inferSelect;

export type WebhookReport = {
  project: string;
  name: string;
  action: string;
  webhookGid?: string | null;
  error?: string;
};

/** ¿Asana reporta el webhook activo? false si no existe (404) o está caído. */
async function asanaWebhookActive(webhookGid: string): Promise<boolean> {
  try {
    return (await getWebhookFilters(webhookGid)).active;
  } catch (error) {
    if (error instanceof AsanaApiError && error.status === 404) return false;
    throw error;
  }
}

async function registerWebhook(link: LinkRow, baseUrl: string) {
  const workspaceGid = process.env.ASANA_WORKSPACE_GID?.trim();
  if (!workspaceGid) throw new Error("Falta ASANA_WORKSPACE_GID.");
  const target = webhookTarget(baseUrl, link.asanaProjectGid);
  // Sin el secreto de un webhook previo no se pueden validar sus firmas: se
  // borra y se crea uno nuevo (Asana hace el handshake contra este deploy).
  const previous = (
    await listWebhooks(workspaceGid, link.asanaProjectGid)
  ).filter((hook) => hook.target === target);
  for (const hook of previous) await deleteWebhook(hook.gid);
  await prepareRegistration(link.asanaProjectGid);
  try {
    const created = await createWebhook(link.asanaProjectGid, target);
    await completeRegistration(link.asanaProjectGid, created.gid);
    return created.gid;
  } catch (error) {
    await failRegistration(link.asanaProjectGid);
    throw error;
  }
}

/**
 * Cada vínculo activo con su webhook vivo; los apagados sin webhook (salvo
 * los proyectos del flujo de correo, que lo necesitan). Recrea los que Asana
 * desactivó por fallas.
 */
export async function ensureLinkWebhooks(
  options: { dryRun?: boolean; deadline?: number; projectGid?: string } = {},
): Promise<WebhookReport[]> {
  const baseUrl = appBaseUrl();
  if (!baseUrl) throw new Error("Sin URL pública (NEXT_PUBLIC_SITE_URL).");
  const links = options.projectGid
    ? await db
        .select()
        .from(asanaSlackLinks)
        .where(eq(asanaSlackLinks.asanaProjectGid, options.projectGid))
    : await db.select().from(asanaSlackLinks);
  const rows = links.length
    ? await db
        .select()
        .from(asanaWebhooks)
        .where(
          inArray(
            asanaWebhooks.asanaProjectGid,
            links.map((l) => l.asanaProjectGid),
          ),
        )
    : [];
  const rowByProject = new Map(rows.map((r) => [r.asanaProjectGid, r]));
  const report: WebhookReport[] = [];

  for (const link of links) {
    if (options.deadline && Date.now() > options.deadline) break;
    const entry: WebhookReport = {
      project: link.asanaProjectGid,
      name: link.asanaProjectName,
      action: "ok",
    };
    try {
      const row = rowByProject.get(link.asanaProjectGid) ?? null;
      const registered = row?.status === "active" && row.webhookGid;
      const asanaActive =
        link.active && registered
          ? await asanaWebhookActive(row.webhookGid!)
          : null;
      const action = planWebhook({
        linkActive: link.active,
        emailProject: await isEmailChannelProject(link.asanaProjectGid),
        row,
        asanaActive,
      });
      entry.action = action;
      entry.webhookGid = row?.webhookGid ?? null;
      if (options.dryRun || action === "keep") {
        report.push(entry);
        continue;
      }
      if (action === "register") {
        entry.webhookGid = await registerWebhook(link, baseUrl);
      } else if (action === "remove" && row?.webhookGid) {
        await deleteWebhook(row.webhookGid).catch((error) => {
          if (!(error instanceof AsanaApiError && error.status === 404)) {
            throw error;
          }
        });
        await db
          .delete(asanaWebhooks)
          .where(eq(asanaWebhooks.asanaProjectGid, link.asanaProjectGid));
        entry.webhookGid = null;
      }
      if (entry.webhookGid !== link.asanaWebhookGid) {
        await db
          .update(asanaSlackLinks)
          .set({ asanaWebhookGid: entry.webhookGid, updatedAt: new Date() })
          .where(eq(asanaSlackLinks.id, link.id));
      }
    } catch (error) {
      entry.action = "error";
      entry.error = error instanceof Error ? error.message : String(error);
      console.error("[slack-notify:webhook]", link.asanaProjectGid, error);
    }
    report.push(entry);
  }
  return report;
}

/**
 * Red de seguridad si un webhook estuvo caído: los comentarios con mención y
 * las tareas reabiertas de las últimas 24 h (nunca antes del vínculo) que no
 * estén en el log se avisan ahora. Idempotente: lo ya publicado se omite.
 */
export async function reconcileLinkStories(
  options: { hours?: number; deadline?: number; dryRun?: boolean } = {},
) {
  const now = new Date();
  const links = await db
    .select()
    .from(asanaSlackLinks)
    .where(eq(asanaSlackLinks.active, true));
  const result = { projects: 0, tasks: 0, candidates: 0, sent: 0 };

  for (const link of links) {
    if (options.deadline && Date.now() > options.deadline) break;
    const since = reconcileSince(now, link.createdAt, options.hours);
    try {
      const taskGids = await listModifiedTaskGids(link.asanaProjectGid, since);
      result.projects++;
      for (const taskGid of taskGids) {
        if (options.deadline && Date.now() > options.deadline) break;
        result.tasks++;
        const stories = (await listTaskStories(taskGid, 3)).filter(
          (story) =>
            story.created_at &&
            new Date(story.created_at) >= since &&
            storyEventKind(story) !== null,
        );
        if (!stories.length) continue;
        const done = new Set(
          (
            await db
              .select({ key: slackNotifyLog.eventKey })
              .from(slackNotifyLog)
              .where(
                inArray(
                  slackNotifyLog.eventKey,
                  stories.map((s) => `story:${s.gid}`),
                ),
              )
          ).map((r) => r.key),
        );
        for (const story of stories) {
          if (done.has(`story:${story.gid}`)) continue;
          result.candidates++;
          if (options.dryRun) continue;
          const outcome = await notifyAsanaStory({
            storyGid: story.gid,
            projectGid: link.asanaProjectGid,
            story,
          });
          if (outcome === "enviado") result.sent++;
        }
      }
    } catch (error) {
      console.error("[slack-notify:reconcile]", link.asanaProjectGid, error);
    }
  }
  return result;
}
