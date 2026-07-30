import "server-only";

import { createHash } from "node:crypto";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { clientRequests } from "@/db/schema";
import { createAsanaTask } from "@/features/asana/asana";
import { logActivity } from "@/lib/activity";
import { resolveAsanaProjectGid, type AsanaTargetChannel } from "./asana-target";

export type RequestMaterializationInput = {
  botChannel: AsanaTargetChannel & { clientId: string };
  conversationId: string;
  sender: { id: string; displayName: string; profile: string };
  sourceMessageId: string;
  rawText: string;
  clientName: string;
  summary: string;
  scopeClass: "in_scope" | "additional" | "unknown";
  dueDate: string | null;
  deliverable: string | null;
  references: string[] | null;
};

export type RequestMaterializationResult = {
  requestId: string;
  folio: string;
  status: "in_asana" | "pending";
  asanaTaskGid: string | null;
  asanaUrl: string | null;
  duplicate: boolean;
  additionalNotice: string | null;
};

export async function materializeClientRequest(
  input: RequestMaterializationInput,
): Promise<RequestMaterializationResult> {
  const idempotencyKey = requestKey(input);
  const existing = await findExisting(idempotencyKey, input.sourceMessageId);
  if (existing) return toResult(existing, true);

  const [inserted] = await db
    .insert(clientRequests)
    .values({
      clientId: input.botChannel.clientId,
      projectId: input.botChannel.projectId,
      botChannelId: input.botChannel.id,
      senderId: input.sender.id,
      sourceMessageId: input.sourceMessageId,
      idempotencyKey,
      rawText: input.rawText,
      normalizedSummary: input.summary,
      scopeClass: input.scopeClass,
      status: "pending",
    })
    .onConflictDoNothing()
    .returning();
  if (!inserted) {
    const winner = await findExisting(idempotencyKey, input.sourceMessageId);
    if (!winner) {
      throw new Error("No se pudo resolver la solicitud idempotente.");
    }
    return toResult(winner, true);
  }

  await logActivity({
    entityType: "client_request",
    entityId: inserted.id,
    action: "request_captured",
  });

  const projectGid = await resolveAsanaProjectGid(input.botChannel);
  if (!projectGid) return toResult(inserted, false);

  // Reclama el único intento externo antes de llamar. Si el proceso cae tras
  // este punto, queda pending para revisión humana en vez de duplicar la tarea.
  const [claimed] = await db
    .update(clientRequests)
    .set({ asanaAttemptedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(clientRequests.id, inserted.id),
        isNull(clientRequests.asanaAttemptedAt),
      ),
    )
    .returning();
  if (!claimed) return toResult(inserted, true);

  const asana = await createAsanaTask({
    name: `${input.clientName} · ${input.summary}`.slice(0, 250),
    notes: formatAsanaNotes(input),
    projectGid,
  });
  if (!asana.connected) return toResult(inserted, false);

  const [updated] = await db
    .update(clientRequests)
    .set({
      asanaTaskGid: asana.gid || null,
      asanaUrl: asana.url,
      status: "in_asana",
      updatedAt: new Date(),
    })
    .where(eq(clientRequests.id, inserted.id))
    .returning();
  return toResult(updated ?? inserted, false);
}

function findExisting(idempotencyKey: string, sourceMessageId: string) {
  return db.query.clientRequests.findFirst({
    where: or(
      eq(clientRequests.idempotencyKey, idempotencyKey),
      eq(clientRequests.sourceMessageId, sourceMessageId),
    ),
  });
}

function requestKey(input: RequestMaterializationInput) {
  const normalized = input.summary
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256")
    .update(
      [
        input.botChannel.id,
        input.conversationId,
        input.sender.id,
        normalized,
      ].join(":"),
    )
    .digest("hex");
}

function formatAsanaNotes(input: RequestMaterializationInput) {
  const scopeLabel =
    input.scopeClass === "additional"
      ? "SOLICITUD ADICIONAL — fuera del acuerdo mensual"
      : input.scopeClass === "in_scope"
        ? "Dentro del alcance registrado"
        : "Alcance pendiente de revisión";
  return [
    "Solicitud creada por el bot desde WhatsApp.",
    "",
    `Solicitante: ${input.sender.displayName} (${input.sender.profile})`,
    `Resumen: ${input.summary}`,
    `Alcance: ${scopeLabel}`,
    `Fecha objetivo: ${input.dueDate ?? "Por confirmar"}`,
    `Entregable: ${input.deliverable ?? "Por confirmar"}`,
    `Referencias: ${input.references?.join(", ") || "Sin referencias"}`,
    "",
    input.scopeClass === "additional"
      ? "Constancia: se registra y toma igualmente como solicitud adicional para revisión del equipo."
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function toResult(
  request: typeof clientRequests.$inferSelect,
  duplicate: boolean,
): RequestMaterializationResult {
  return {
    requestId: request.id,
    folio: request.id.slice(0, 8).toUpperCase(),
    status: request.status === "in_asana" ? "in_asana" : "pending",
    asanaTaskGid: request.asanaTaskGid,
    asanaUrl: request.asanaUrl,
    duplicate,
    additionalNotice:
      request.scopeClass === "additional"
        ? "Queda registrado como solicitud adicional fuera del acuerdo mensual; el equipo la tomará como tal."
        : null,
  };
}
