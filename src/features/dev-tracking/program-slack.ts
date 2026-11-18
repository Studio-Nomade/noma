import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { devPrograms, emailChannels } from "@/db/schema";

/**
 * Variable del webhook de Slack para los avisos de un programa: la del
 * programa; si no tiene, la del canal de correo de su proyecto. Null → el
 * aviso usa SLACK_OPERATIONS_WEBHOOK_URL (canal operativo general).
 */
export async function programSlackWebhookEnv(
  programId: string,
): Promise<string | null> {
  const [program] = await db
    .select({
      env: devPrograms.slackWebhookEnv,
      projectId: devPrograms.projectId,
    })
    .from(devPrograms)
    .where(eq(devPrograms.id, programId))
    .limit(1);
  if (!program) return null;
  if (program.env) return program.env;
  const [channel] = await db
    .select({ env: emailChannels.slackWebhookEnv })
    .from(emailChannels)
    .where(
      and(
        eq(emailChannels.projectId, program.projectId),
        isNotNull(emailChannels.slackWebhookEnv),
      ),
    )
    .limit(1);
  return channel?.env ?? null;
}
