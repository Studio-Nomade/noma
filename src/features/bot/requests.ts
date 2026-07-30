import "server-only";

import { createHash } from "node:crypto";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { clientRequests } from "@/db/schema";
import { createAsanaTask } from "@/features/asana/asana";
import { logActivity } from "@/lib/activity";
import {
  resolveAsanaProjectGid,
  type AsanaTargetChannel,
} from "./asana-target";
import { notifyNewClientRequest } from "./notify";
import { classifyScope } from "./scope";
import { consumeRequest } from "@/features/retainers/periods";

export type RequestMaterializationInput = {
  botChannel: AsanaTargetChannel & { clientId: string };
  conversationId: string;
  sender: { id: string; displayName: string; profile: string };
  sourceMessageId: string;
  rawText: string;
  clientName: string;
  projectName: string;
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
  scopeNotice: string | null;
  additionalNotice: string | null;
};

export async function materializeClientRequest(
  input: RequestMaterializationInput,
): Promise<RequestMaterializationResult> {
  const idempotencyKey = requestKey(input);
  const existing = await findExisting(idempotencyKey, input.sourceMessageId);
  if (existing) return toResult(existing, true);
  const decision = await classifyScope({
    botChannel: input.botChannel,
    summary: input.summary,
  });
  let effectiveInput = {
    ...input,
    scopeClass: decision.scopeClass,
  };

  const [created] = await db
    .insert(clientRequests)
    .values({
      clientId: input.botChannel.clientId,
      projectId: input.botChannel.projectId,
      botChannelId: input.botChannel.id,
      senderId: input.sender.id,
      conversationId: input.conversationId,
      sourceMessageId: input.sourceMessageId,
      idempotencyKey,
      rawText: input.rawText,
      normalizedSummary: input.summary,
      scopeClass: decision.scopeClass,
      predictedScopeClass: decision.scopeClass,
      scopeReason: decision.reason,
      retainerPeriodId: decision.retainerPeriodId,
      estimatedUnits:
        decision.estimatedUnits === null
          ? null
          : decision.estimatedUnits.toFixed(2),
      status: "pending",
    })
    .onConflictDoNothing()
    .returning();
  if (!created) {
    const winner = await findExisting(idempotencyKey, input.sourceMessageId);
    if (!winner) {
      throw new Error("No se pudo resolver la solicitud idempotente.");
    }
    return toResult(winner, true);
  }
  let inserted = created;

  await logActivity({
    entityType: "client_request",
    entityId: inserted.id,
    action: "request_captured",
  });

  if (
    decision.scopeClass === "in_scope" &&
    decision.retainerPeriodId &&
    decision.estimatedUnits
  ) {
    const consumption = await consumeRequest(inserted.id);
    if (!consumption.ok) {
      const reason =
        "El alcance coincide, pero el saldo cambió antes de confirmar; se registró como adicional.";
      const [updated] = await db
        .update(clientRequests)
        .set({
          scopeClass: "additional",
          scopeReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(clientRequests.id, inserted.id))
        .returning();
      inserted = updated ?? inserted;
      effectiveInput = { ...effectiveInput, scopeClass: "additional" };
    }
  }

  const projectGid = await resolveAsanaProjectGid(input.botChannel);
  if (!projectGid) return finishNewRequest(inserted, effectiveInput);

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
    name: `${effectiveInput.clientName} · ${effectiveInput.summary}`.slice(
      0,
      250,
    ),
    notes: formatAsanaNotes(effectiveInput),
    projectGid,
  });
  if (!asana.connected) return finishNewRequest(inserted, effectiveInput);

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
  return finishNewRequest(updated ?? inserted, effectiveInput);
}

async function finishNewRequest(
  request: typeof clientRequests.$inferSelect,
  input: RequestMaterializationInput,
) {
  // Slack es un espejo degradable: nunca bloquea la captura ni la respuesta.
  await notifyNewClientRequest({
    requestId: request.id,
    clientName: input.clientName,
    projectName: input.projectName,
    summary: input.summary,
    scopeClass: input.scopeClass,
    asanaUrl: request.asanaUrl,
  });
  return toResult(request, false);
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
    scopeNotice:
      request.scopeClass === "in_scope"
        ? request.retainerConsumedAt && request.estimatedUnits
          ? `Dentro del acuerdo mensual. Se descontaron ${Number(request.estimatedUnits).toLocaleString("es-CL")} unidad(es) de la bolsa vigente.`
          : "Dentro del alcance registrado."
        : request.scopeClass === "unknown"
          ? "El alcance quedó pendiente de revisión por el equipo."
          : null,
    additionalNotice:
      request.scopeClass === "additional"
        ? "Queda registrado como solicitud adicional fuera del acuerdo mensual; el equipo la tomará como tal."
        : null,
  };
}
