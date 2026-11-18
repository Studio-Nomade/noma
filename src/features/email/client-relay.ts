import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clientRequests, requestDeliveries } from "@/db/schema";
import {
  addStory,
  getTaskAssignee,
  getTaskState,
  setEnumFieldByName,
  setTaskCompleted,
  setTaskDueOn,
  type AsanaStory,
} from "@/features/asana/asana";
import { notifyTeamEvent, teamSlackUserIds } from "@/features/bot/notify";
import {
  adjustmentsMessage,
  pieceApprovedMessage,
  slackMention,
} from "@/features/bot/team-events";
import { logActivity } from "@/lib/activity";
import { buildAdjustmentsStoryHtml } from "./asana-content";
import type { ClientRelayCommand } from "./delivery-command";
import { classifyReply } from "./reply-classify";
import {
  ESTADO_ADJUSTMENTS,
  ESTADO_APPROVED,
  ESTADO_FIELD,
  TICKET_FIELD,
  lastConsultaQuestions,
  lastSentDelivery,
  requestTitle,
  sendThreadEmail,
  structuredGenerator,
} from "./requests";
import type { EmailRequestRow } from "./store";
import { getChannel } from "./store";
import { escapeHtml, renderCommentAckEmail } from "./templates";

export type ClientRelayOutcome =
  "relayed" | "skipped_duplicate" | "skipped_no_request";

/**
 * «CLIENTE: …» en Asana: un mensaje del cliente que llegó por otro canal
 * (WhatsApp, llamada) entra al flujo como si hubiera respondido el correo:
 *
 * 1. La IA lo clasifica (ajustes, aprobación, pregunta, info).
 * 2. Ajustes → la tarea comentada (pieza o solicitud) pasa a «Con ajustes»,
 *    comentario con los ajustes y aviso en Slack etiquetando al responsable.
 *    Aprobación → la tarea queda Aprobado / Finalizado y se completa.
 * 3. Acuse corto en el hilo de correo con lo que registramos, para que el
 *    cliente y su equipo tengan constancia escrita.
 *
 * Idempotente por story (fila `request_deliveries` con kind «cliente»).
 */
export async function processClientRelay(input: {
  story: AsanaStory;
  relay: ClientRelayCommand;
  request: EmailRequestRow;
  /** Tarea donde se comentó (pieza o la solicitud misma). */
  taskGid: string;
  piece: { taskGid: string; label: string } | null;
}): Promise<ClientRelayOutcome> {
  const { story, relay, request, taskGid, piece } = input;
  if (!request.emailChannelId || !request.emailThreadId) {
    return "skipped_no_request";
  }

  const [claimed] = await db
    .insert(requestDeliveries)
    .values({
      clientRequestId: request.id,
      kind: "cliente",
      round: 0,
      asanaStoryGid: story.gid,
      links: [],
      files: [],
      appliedAdjustments: [],
      note: `${relay.via}: ${relay.text}`.slice(0, 4000),
      status: "sending",
    })
    .onConflictDoNothing({ target: requestDeliveries.asanaStoryGid })
    .returning();
  let row = claimed;
  if (!row) {
    const [retry] = await db
      .update(requestDeliveries)
      .set({ status: "sending", error: null, updatedAt: new Date() })
      .where(
        and(
          eq(requestDeliveries.asanaStoryGid, story.gid),
          inArray(requestDeliveries.status, ["failed"]),
        ),
      )
      .returning();
    if (!retry) return "skipped_duplicate";
    row = retry;
  }

  try {
    const channel = await getChannel(request.emailChannelId);
    if (!channel) throw new Error("Canal de correo no encontrado.");
    const projectGid = channel.asanaProjectGid;
    const receivedAt = story.created_at
      ? new Date(story.created_at)
      : new Date();
    const delivery = await lastSentDelivery(request.id);
    const what = piece ? `«${piece.label}»` : "la solicitud";

    const { classification, error } = await classifyReply(
      {
        folio: request.folio ?? "",
        title: piece?.label ?? requestTitle(request),
        lastDeliveryRound: delivery?.round ?? null,
        openQuestions: await lastConsultaQuestions(request.id),
        fromName: request.requesterName,
        date: receivedAt,
        body: relay.text,
      },
      structuredGenerator(),
    );
    const reply = classification ?? {
      kind: "info" as const,
      points: [relay.text.slice(0, 280)],
      adjustments: [],
      doubts: [],
      new_due_date: null,
      new_priority: null,
      new_format: null,
    };

    // Asana y equipo (degradable: el registro no debe caerse por un campo).
    const task = await getTaskState(taskGid).catch(() => null);
    const assignee = await getTaskAssignee(taskGid).catch(() => null);
    const estado = (options: string[]) =>
      setEnumFieldByName(taskGid, projectGid, ESTADO_FIELD, options).catch(
        () => false,
      );
    if (reply.kind === "adjustments") {
      if (task?.completed) await setTaskCompleted(taskGid, false);
      await estado(ESTADO_ADJUSTMENTS);
      if (!piece) {
        await db
          .update(clientRequests)
          .set({
            emailPendingAdjustments: reply.adjustments,
            updatedAt: new Date(),
          })
          .where(eq(clientRequests.id, request.id));
      }
      await addStory(
        taskGid,
        buildAdjustmentsStoryHtml({
          round: delivery?.round ?? null,
          adjustments: reply.adjustments,
          doubts: reply.doubts,
        }),
      ).catch(() => undefined);
      await notifyTeamEvent(
        adjustmentsMessage({
          folio: request.folio,
          clientName: channel.clientName,
          round: delivery?.round ?? null,
          asanaUrl: request.asanaUrl,
          assignee: slackMention(assignee, teamSlackUserIds()),
        }),
        channel.slackWebhookEnv,
      );
    } else if (reply.kind === "approval") {
      await estado(ESTADO_APPROVED);
      await setEnumFieldByName(taskGid, projectGid, TICKET_FIELD, [
        "Finalizado",
      ]).catch(() => false);
      if (!task?.completed) await setTaskCompleted(taskGid, true);
      await notifyTeamEvent(
        pieceApprovedMessage({
          folio: request.folio,
          clientName: channel.clientName,
          piece: piece?.label ?? requestTitle(request),
          remaining: [],
          asanaUrl: request.asanaUrl,
        }),
        channel.slackWebhookEnv,
      );
    }
    if (reply.new_due_date && reply.new_due_date !== task?.due_on) {
      await setTaskDueOn(taskGid, reply.new_due_date).catch(() => undefined);
    }

    // Acuse en el hilo: constancia escrita de lo que llegó por otro canal.
    const points =
      reply.kind === "adjustments" && reply.adjustments.length
        ? reply.adjustments.map((item) =>
            item.reference ? `${item.text} (${item.reference})` : item.text,
          )
        : reply.points.length
          ? reply.points
          : [relay.text.slice(0, 280)];
    const rendered = renderCommentAckEmail({
      folio: request.folio ?? "",
      clientName: channel.clientName,
      alias: channel.alias,
      title: requestTitle(request),
      requesterName: request.requesterName,
      receivedAt,
      stage: 2,
      isQuestion: reply.kind === "question",
      points: [
        `Lo recibimos por ${relay.via} y lo registramos en ${what}.`,
        ...(reply.kind === "approval"
          ? [`Aprobaste ${what} como versión final.`]
          : []),
        ...points,
      ].slice(0, 8),
      pending: reply.doubts,
    });
    const sent = await sendThreadEmail(request, channel, rendered, {
      extraCc: assignee?.email ? [assignee.email] : [],
    });

    await db
      .update(requestDeliveries)
      .set({
        status: "sent",
        sentAt: new Date(),
        sentGmailMessageId: sent.id,
        error: error?.slice(0, 500) ?? null,
        updatedAt: new Date(),
      })
      .where(eq(requestDeliveries.id, row.id));
    const label = {
      adjustments: `ajustes (${reply.adjustments.length})`,
      approval: "aprobación",
      question: "pregunta",
      info: "información",
      empty: "sin contenido",
      ambiguous: "por revisar (ambiguo)",
    }[reply.kind];
    await addStory(
      taskGid,
      `<body><em>${escapeHtml(
        `Noma registró el mensaje del cliente (${relay.via}) como ${label} y dejó constancia en el hilo de correo de ${request.folio ?? "la solicitud"}.`,
      )}</em></body>`,
    ).catch(() => undefined);
    await logActivity({
      entityType: "client_request",
      entityId: request.id,
      action: "client_relay_recorded",
    });
    return "relayed";
  } catch (error) {
    await db
      .update(requestDeliveries)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 500) : "Error",
        updatedAt: new Date(),
      })
      .where(eq(requestDeliveries.id, row.id));
    throw error;
  }
}
