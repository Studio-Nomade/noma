import "server-only";

import { and, desc, eq, gte, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientRequests, requestDeliveries } from "@/db/schema";
import { addStory, listRecentTasksWithNotes } from "@/features/asana/asana";
import { escapeHtml } from "./templates";
import { canvaIdFromUrl, extractCanvaDesignIds } from "./design-link-parse";

/** Cuánto hacia atrás se busca la tarea de diseño. */
const LOOKBACK_DAYS = 120;
const MAX_SHORT_LINKS = 5;

/**
 * `canva.link/xxxx` redirige a `canva.com/design/<id>/…`: se lee el Location
 * sin seguirlo. Degradable: un link que no resuelve se ignora.
 */
export async function resolveCanvaShortLinks(urls: string[]) {
  const ids: string[] = [];
  for (const url of urls.slice(0, MAX_SHORT_LINKS)) {
    try {
      let current = url;
      for (let hop = 0; hop < 3; hop += 1) {
        const res = await fetch(current, {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(4_000),
        });
        const location = res.headers.get("location");
        if (!location) break;
        const next = new URL(location, current).toString();
        const id = canvaIdFromUrl(next);
        if (id) {
          ids.push(id);
          break;
        }
        current = next;
      }
    } catch {
      // Sin red o link roto: se sigue con los demás.
    }
  }
  return ids;
}

export type DesignTaskMatch = {
  taskGid: string;
  folio: string | null;
  designId: string;
  source: "noma" | "asana";
};

/**
 * Busca la tarea de diseño que comparte un diseño de Canva con la nueva
 * solicitud: primero en Noma (correo original o entregas de otra solicitud
 * del mismo proyecto) y luego en las descripciones de las tareas recientes
 * del tablero (solicitudes que no pasaron por Noma).
 */
export async function findDesignTask(input: {
  requestId: string;
  projectId: string;
  asanaProjectGid: string;
  newTaskGid: string;
  designIds: string[];
}): Promise<DesignTaskMatch | null> {
  if (!input.designIds.length) return null;
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);

  for (const designId of input.designIds) {
    const pattern = `%${designId}%`;
    const [byRequest] = await db
      .select({
        taskGid: clientRequests.asanaTaskGid,
        folio: clientRequests.folio,
      })
      .from(clientRequests)
      .where(
        and(
          eq(clientRequests.projectId, input.projectId),
          ne(clientRequests.id, input.requestId),
          isNotNull(clientRequests.asanaTaskGid),
          gte(clientRequests.createdAt, since),
          or(
            sql`${clientRequests.rawText} ilike ${pattern}`,
            sql`exists (
              select 1 from ${requestDeliveries}
              where ${requestDeliveries.clientRequestId} = ${clientRequests.id}
                and (array_to_string(${requestDeliveries.links}, ' ') ilike ${pattern}
                  or ${requestDeliveries.files}::text ilike ${pattern})
            )`,
          ),
        ),
      )
      .orderBy(desc(clientRequests.createdAt))
      .limit(1);
    if (byRequest?.taskGid && byRequest.taskGid !== input.newTaskGid) {
      return {
        taskGid: byRequest.taskGid,
        folio: byRequest.folio,
        designId,
        source: "noma",
      };
    }
  }

  const tasks = await listRecentTasksWithNotes(input.asanaProjectGid, since);
  for (const designId of input.designIds) {
    const hit = tasks.find(
      (task) => task.gid !== input.newTaskGid && task.notes.includes(designId),
    );
    if (hit) {
      return { taskGid: hit.gid, folio: null, designId, source: "asana" };
    }
  }
  return null;
}

/**
 * Relaciona la tarea nueva (desarrollo) con la de diseño que comparte el
 * Canva: un comentario en cada una con el enlace a la otra. Degradable: si
 * algo falla, la solicitud sigue su curso.
 */
export async function linkDesignTask(input: {
  requestId: string;
  projectId: string;
  asanaProjectGid: string;
  newTaskGid: string;
  folio: string | null;
  texts: (string | null | undefined)[];
}): Promise<DesignTaskMatch | null> {
  const parsed = extractCanvaDesignIds(input.texts);
  const resolved = parsed.shortLinks.length
    ? await resolveCanvaShortLinks(parsed.shortLinks)
    : [];
  const designIds = [...new Set([...parsed.ids, ...resolved])];
  const match = await findDesignTask({ ...input, designIds });
  if (!match) return null;

  const folioLabel = input.folio ? ` (${escapeHtml(input.folio)})` : "";
  await addStory(
    input.newTaskGid,
    `<body><strong>Diseño relacionado:</strong> <a data-asana-gid="${match.taskGid}"/>. Comparten el Canva <code>${escapeHtml(match.designId)}</code>.</body>`,
  );
  await addStory(
    match.taskGid,
    `<body><strong>Desarrollo relacionado:</strong> <a data-asana-gid="${input.newTaskGid}"/>${folioLabel}. Comparten el Canva <code>${escapeHtml(match.designId)}</code>.</body>`,
  );
  return match;
}
