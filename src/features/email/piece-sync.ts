import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientRequests } from "@/db/schema";
import {
  getTaskFields,
  removeTaskFromProject,
  setTaskCustomFields,
} from "@/features/asana/asana";
import { duplicatedProjects, pieceFieldValues } from "./pieces";

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
export async function syncPiece(taskGid: string): Promise<PieceSyncOutcome> {
  const piece = await getTaskFields(taskGid);
  const parentGid = piece?.parent?.gid;
  if (!parentGid) return "skipped_lifecycle";
  const request = await db.query.clientRequests.findFirst({
    columns: { id: true },
    where: and(
      eq(clientRequests.channel, "email"),
      eq(clientRequests.asanaTaskGid, parentGid),
    ),
  });
  if (!request) return "skipped_lifecycle";
  const parent = await getTaskFields(parentGid);

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
