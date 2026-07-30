import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  botChannels,
  projects,
  resourceLinks,
  type BotChannel,
} from "@/db/schema";
import { parseAsanaTarget } from "@/features/dashboard/integrations";

export type AsanaTargetChannel = Pick<
  BotChannel,
  "id" | "projectId" | "asanaProjectGid"
>;

export async function resolveAsanaProjectGid(
  botChannel: AsanaTargetChannel,
): Promise<string | null> {
  const direct = botChannel.asanaProjectGid?.trim();
  if (direct) return direct;

  const [[project], links] = await Promise.all([
    db
      .select({ asanaProjectGid: projects.asanaProjectGid })
      .from(projects)
      .where(eq(projects.id, botChannel.projectId))
      .limit(1),
    db
      .select({ url: resourceLinks.url })
      .from(resourceLinks)
      .where(
        and(
          eq(resourceLinks.entityType, "project"),
          eq(resourceLinks.entityId, botChannel.projectId),
          eq(resourceLinks.type, "asana"),
        ),
      )
      .orderBy(desc(resourceLinks.createdAt)),
  ]);
  const projectGid = project?.asanaProjectGid?.trim();
  if (projectGid) {
    await cacheTarget(botChannel.id, projectGid);
    return projectGid;
  }

  for (const link of links) {
    const target = parseAsanaTarget(link.url);
    const gid =
      target?.kind === "project" ? target.gid : target?.projectGid?.trim();
    if (!gid) continue;
    await cacheTarget(botChannel.id, gid);
    return gid;
  }
  return null;
}

async function cacheTarget(channelId: string, gid: string) {
  await db
    .update(botChannels)
    .set({ asanaProjectGid: gid, updatedAt: new Date() })
    .where(eq(botChannels.id, channelId));
}
