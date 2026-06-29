import { db } from "@/db";
import { integrationSyncLog } from "@/db/schema";
import type { Integration } from "@/types/enums";

/**
 * Registro de sincronización de integraciones (Chipax/Nubox).
 * Cada llamada a una API externa debería dejar una entrada aquí.
 */
export async function logSync(entry: {
  integration: Integration;
  action: string;
  status: "ok" | "error";
  entityType?: string;
  entityId?: string;
  message?: string;
  payload?: unknown;
}): Promise<void> {
  await db.insert(integrationSyncLog).values({
    integration: entry.integration,
    action: entry.action,
    status: entry.status,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    message: entry.message ?? null,
    payload: entry.payload ?? null,
  });
}
