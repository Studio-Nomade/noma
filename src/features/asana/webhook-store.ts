import "server-only";

import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { asanaWebhooks } from "@/db/schema";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";

/**
 * Secretos de webhooks de Asana por proyecto (cifrados con
 * NOMA_TOKEN_ENCRYPTION_KEY, como user_connections).
 *
 * Flujo de registro (scripts/asana-register-webhooks.ts):
 * 1. prepareRegistration → fila `pending` (abre una ventana de 10 min).
 * 2. POST /webhooks en Asana → Asana hace el handshake contra
 *    /api/webhooks/asana?project=<gid> con X-Hook-Secret → acceptHandshake.
 * 3. completeRegistration → `active` con el gid del webhook (solo si Asana
 *    confirmó la creación). Si falla, failRegistration → `failed`.
 * Un handshake fuera de esa ventana se rechaza, y las firmas solo se validan
 * contra filas `active`: un secreto plantado por un tercero dentro de la
 * ventana hace fallar el handshake real de Asana y nunca llega a usarse.
 */

const HANDSHAKE_WINDOW = sql`now() - interval '10 minutes'`;

export async function prepareRegistration(projectGid: string) {
  await db
    .insert(asanaWebhooks)
    .values({ asanaProjectGid: projectGid, status: "pending" })
    .onConflictDoUpdate({
      target: asanaWebhooks.asanaProjectGid,
      set: {
        status: "pending",
        secret: null,
        webhookGid: null,
        updatedAt: new Date(),
      },
    });
}

export async function acceptHandshake(
  projectGid: string,
  secret: string,
): Promise<boolean> {
  if (!secret || secret.length > 512) return false;
  const [row] = await db
    .update(asanaWebhooks)
    .set({
      secret: encryptToken(secret),
      status: "handshake",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(asanaWebhooks.asanaProjectGid, projectGid),
        eq(asanaWebhooks.status, "pending"),
        gt(asanaWebhooks.updatedAt, HANDSHAKE_WINDOW),
      ),
    )
    .returning({ id: asanaWebhooks.id });
  return Boolean(row);
}

export async function completeRegistration(
  projectGid: string,
  webhookGid: string,
) {
  await db
    .update(asanaWebhooks)
    .set({ webhookGid, status: "active", updatedAt: new Date() })
    .where(eq(asanaWebhooks.asanaProjectGid, projectGid));
}

export async function failRegistration(projectGid: string) {
  await db
    .update(asanaWebhooks)
    .set({ status: "failed", secret: null, updatedAt: new Date() })
    .where(eq(asanaWebhooks.asanaProjectGid, projectGid));
}

export async function getWebhookSecret(
  projectGid: string,
): Promise<string | null> {
  const [row] = await db
    .select({ secret: asanaWebhooks.secret })
    .from(asanaWebhooks)
    .where(
      and(
        eq(asanaWebhooks.asanaProjectGid, projectGid),
        eq(asanaWebhooks.status, "active"),
      ),
    )
    .limit(1);
  if (!row?.secret) return null;
  try {
    return decryptToken(row.secret);
  } catch {
    return null;
  }
}

export async function touchWebhook(projectGid: string) {
  await db
    .update(asanaWebhooks)
    .set({ lastEventAt: new Date() })
    .where(eq(asanaWebhooks.asanaProjectGid, projectGid));
}

export async function listRegisteredWebhooks() {
  return db.select().from(asanaWebhooks);
}
