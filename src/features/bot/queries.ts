import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { botAuthorizedSenders, botChannels } from "@/db/schema";

export async function getBotChannelForProject(projectId: string) {
  const [channel] = await db
    .select()
    .from(botChannels)
    .where(eq(botChannels.projectId, projectId))
    .limit(1);
  if (!channel) return null;

  const senders = await db
    .select()
    .from(botAuthorizedSenders)
    .where(
      and(
        eq(botAuthorizedSenders.botChannelId, channel.id),
        eq(botAuthorizedSenders.status, "active"),
      ),
    )
    .orderBy(asc(botAuthorizedSenders.displayName));

  return { channel, senders };
}
