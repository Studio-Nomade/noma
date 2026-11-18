import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientRequests } from "@/db/schema";
import {
  getTaskFields,
  getTaskState,
  removeTaskFromProject,
  setTaskCustomFields,
} from "@/features/asana/asana";
import {
  MAX_PIECE_DEPTH,
  duplicatedProjects,
  pieceFieldValues,
  pieceLabel,
} from "./pieces";

export type PieceSyncOutcome = "piece_synced" | "skipped_lifecycle";

/**
 * Deja al día una subtarea (pieza) de una solicitud de correo:
 *
 * - Copia desde la solicitud los campos vacíos (folio, prioridad, ticket,
 *   correo, ingreso, área…). Estado, rondas, formato y brief son de la pieza.
 * - Si la pieza también está en el proyecto de la solicitud (p. ej. una tarea
 *   que el equipo movió como subtarea), la saca del listado principal para
 *   que no se vea duplicada: queda solo dentro de la solicitud.
 *
 * Idempotente: se llama al crear o mover la subtarea y, de respaldo, en cada
 * entrega o consulta de la pieza.
 */
/**
 * Solicitud de correo a la que pertenece una subtarea, subiendo hasta
 * `MAX_PIECE_DEPTH` niveles (pieza → etapa de la pieza). null si la tarea no
 * cuelga de una solicitud de correo (o si es la solicitud misma).
 */
export async function findRequestAncestor(taskGid: string): Promise<{
  requestTaskGid: string;
  piece: { taskGid: string; label: string | null };
} | null> {
  const task = await getTaskState(taskGid).catch(() => null);
  let parentGid = task?.parent?.gid ?? null;
  for (let depth = 0; parentGid && depth < MAX_PIECE_DEPTH; depth += 1) {
    const request = await db.query.clientRequests.findFirst({
      columns: { id: true },
      where: and(
        eq(clientRequests.channel, "email"),
        eq(clientRequests.asanaTaskGid, parentGid),
      ),
    });
    if (request) {
      return {
        requestTaskGid: parentGid,
        piece: { taskGid, label: pieceLabel(task?.name) },
      };
    }
    const parent = await getTaskState(parentGid).catch(() => null);
    parentGid = parent?.parent?.gid ?? null;
  }
  return null;
}

/**
 * Deja al día una subtarea (pieza o etapa de una pieza) de una solicitud de
 * correo:
 *
 * - Copia desde la solicitud los campos vacíos (folio, prioridad, ticket,
 *   correo, ingreso, área…). Estado, rondas, formato y brief son de la pieza.
 * - Si la pieza también está en el proyecto de la solicitud (p. ej. una tarea
 *   que el equipo movió como subtarea), la saca del listado principal para
 *   que no se vea duplicada: queda solo dentro de la solicitud.
 *
 * Idempotente: se llama al crear o mover la subtarea y, de respaldo, en cada
 * entrega o consulta de la pieza.
 */
export async function syncPiece(taskGid: string): Promise<PieceSyncOutcome> {
  const owner = await findRequestAncestor(taskGid);
  if (!owner) return "skipped_lifecycle";
  const [piece, parent] = await Promise.all([
    getTaskFields(taskGid),
    getTaskFields(owner.requestTaskGid),
  ]);

  const values = pieceFieldValues(
    parent.custom_fields ?? [],
    piece.custom_fields ?? [],
  );
  await setTaskCustomFields(taskGid, values);
  for (const projectGid of duplicatedProjects(
    parent.projects ?? [],
    piece.projects ?? [],
  )) {
    await removeTaskFromProject(taskGid, projectGid);
  }
  return "piece_synced";
}
