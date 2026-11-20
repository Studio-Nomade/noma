import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { peopleIdentities } from "@/db/schema";
import { getUserEmail } from "@/features/asana/asana";
import { parseSlackUserIds } from "@/features/bot/team-events";
import { lookupSlackUserByEmail } from "./slack-bot";

/** Reintento de una búsqueda sin resultado en Slack (persona nueva). */
const RETRY_MISS_MS = 24 * 60 * 60 * 1000;

/**
 * Usuario de Slack de una persona de Asana: `people_identities` (se corrige a
 * mano) → NOMA_SLACK_USER_IDS → `users.lookupByEmail`. Guarda lo que
 * encuentra. Degradable: ante un error devuelve null (va el nombre en
 * negrita, sin mención).
 */
export async function slackUserForAsanaUser(
  asanaUserGid: string,
  hint: { email?: string | null } = {},
): Promise<string | null> {
  try {
    const [byGid] = await db
      .select()
      .from(peopleIdentities)
      .where(eq(peopleIdentities.asanaUserGid, asanaUserGid))
      .limit(1);
    if (byGid?.slackUserId) return byGid.slackUserId;
    if (byGid && Date.now() - byGid.updatedAt.getTime() < RETRY_MISS_MS) {
      return null;
    }

    const email = (
      hint.email ??
      byGid?.email ??
      (await getUserEmail(asanaUserGid).catch(() => null))
    )
      ?.trim()
      .toLowerCase();
    if (!email) return null;

    const [byEmail] = byGid
      ? [byGid]
      : await db
          .select()
          .from(peopleIdentities)
          .where(eq(peopleIdentities.email, email))
          .limit(1);
    const slackUserId =
      byEmail?.slackUserId ??
      parseSlackUserIds(process.env.NOMA_SLACK_USER_IDS).get(email) ??
      (await lookupSlackUserByEmail(email).catch(() => null));

    await db
      .insert(peopleIdentities)
      .values({ email, asanaUserGid, slackUserId, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: peopleIdentities.email,
        set: {
          asanaUserGid,
          ...(slackUserId ? { slackUserId } : {}),
          updatedAt: new Date(),
        },
      });
    return slackUserId;
  } catch (error) {
    console.error("[slack-notify:identity]", asanaUserGid, error);
    return null;
  }
}

/** Traduce varias personas de Asana a la vez (gid → usuario de Slack). */
export async function slackUsersForAsanaUsers(gids: string[]) {
  const map = new Map<string, string | null>();
  for (const gid of gids) map.set(gid, await slackUserForAsanaUser(gid));
  return map;
}
