import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { asanaSlackLinks, asanaWebhooks } from "@/db/schema";
import { DEFAULT_EVENTS } from "./format";

/**
 * Vincula (o cambia de canal) un proyecto de Asana a un canal de Slack. Lo
 * usan la pantalla de vínculos y la creación de canales de proyectos nuevos.
 * Conserva los eventos y el estado de un vínculo que ya existía.
 */
export async function linkProjectToChannel(input: {
  asanaProjectGid: string;
  asanaProjectName: string;
  slackChannelId: string;
  slackChannelName: string;
  folioPrefix?: string | null;
}) {
  const [row] = await db
    .insert(asanaSlackLinks)
    .values({
      asanaProjectGid: input.asanaProjectGid,
      asanaProjectName: input.asanaProjectName,
      slackChannelId: input.slackChannelId,
      slackChannelName: input.slackChannelName.replace(/^#/, ""),
      folioPrefix: input.folioPrefix ?? null,
      events: DEFAULT_EVENTS,
      active: true,
    })
    .onConflictDoUpdate({
      target: asanaSlackLinks.asanaProjectGid,
      set: {
        asanaProjectName: input.asanaProjectName,
        slackChannelId: input.slackChannelId,
        slackChannelName: input.slackChannelName.replace(/^#/, ""),
        ...(input.folioPrefix !== undefined
          ? { folioPrefix: input.folioPrefix }
          : {}),
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return row;
}

export type WebhookHealth = "vivo" | "caido" | "sin_registrar";

/** Vínculos con el estado de su webhook, para la pantalla. */
export async function listLinksWithStatus() {
  const rows = await db
    .select({
      link: asanaSlackLinks,
      webhookStatus: asanaWebhooks.status,
      webhookGid: asanaWebhooks.webhookGid,
      lastEventAt: asanaWebhooks.lastEventAt,
    })
    .from(asanaSlackLinks)
    .leftJoin(
      asanaWebhooks,
      eq(asanaWebhooks.asanaProjectGid, asanaSlackLinks.asanaProjectGid),
    )
    .orderBy(asc(asanaSlackLinks.asanaProjectName));
  return rows.map((row) => ({
    ...row.link,
    webhook: (row.webhookStatus === "active" && row.webhookGid
      ? "vivo"
      : row.webhookStatus === "failed"
        ? "caido"
        : "sin_registrar") as WebhookHealth,
    lastEventAt: row.lastEventAt,
  }));
}

export type LinkWithStatus = Awaited<
  ReturnType<typeof listLinksWithStatus>
>[number];
