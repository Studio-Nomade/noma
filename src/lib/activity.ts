import { db } from "@/db";
import { activityLog } from "@/db/schema";

/**
 * Registra un evento en el historial de actividad (trazabilidad del pipeline).
 * Nunca lanza: la trazabilidad no debe romper la operación principal.
 *
 * `entityType` es libre (ej. "project", "brief", "brief_meeting", "proposal").
 * `action` describe el evento (ej. "stage_changed", "meeting_scheduled").
 */
export async function logActivity(
  input: {
    entityType: string;
    entityId?: string | null;
    action: string;
    actorId?: string | null;
  },
  writer: Pick<typeof db, "insert"> = db,
): Promise<void> {
  try {
    await writer.insert(activityLog).values({
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      actorId: input.actorId ?? null,
    });
  } catch (err) {
    console.error("[logActivity]", err);
  }
}
