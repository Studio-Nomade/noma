import "server-only";

import { and, desc, eq, gt, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientRequests, requestDeliveries } from "@/db/schema";
import {
  addStory,
  getStory,
  getTaskAssignee,
  getTaskState,
  getUserEmail,
  listSubtasks,
  listTaskStories,
  resolveBotUserGid,
  setEnumFieldByName,
  setNumberFieldByName,
  setTaskAssignee,
  taskFieldValue,
  type AsanaStory,
} from "@/features/asana/asana";
import { foldName } from "@/features/asana/custom-fields";
import { notifyTeamEvent } from "@/features/bot/notify";
import { deliverySentMessage } from "@/features/bot/team-events";
import { logActivity } from "@/lib/activity";
import { buildDeliveryAuditStoryHtml } from "./asana-content";
import {
  formatRound,
  parseClientRelayCommand,
  type ClientRelayCommand,
  commentCommandActive,
  parseCommentCommand,
  parseConsultaCommand,
  parseDeliveryCommand,
  type CommentCommand,
} from "./delivery-command";
import { ROUNDS_FIELD } from "@/features/reports/metrics";
import { deliveryCc } from "./delivery-team";
import { processClientRelay, type ClientRelayOutcome } from "./client-relay";
import { findRequestAncestor, syncPiece } from "./piece-sync";
import { replySubject } from "./folio";
import { GmailApiError, createDraftReply, sendReply } from "./inbox";
import { buildReplyThreadHeaders } from "./mime";
import {
  ESTADO_FIELD,
  ESTADO_OUT_OF_SCOPE,
  ESTADO_SENT,
  STUDIO_SENDER_NAME,
  isDefiniteRejection,
  requestTitle,
  studioDomain,
} from "./requests";
import { getChannel } from "./store";
import {
  businessHoursFromEnv,
  deferredSendAt,
  formatBusinessSlot,
  wantsImmediateSend,
} from "./business-hours";
import { isLifecycleStory } from "./lifecycle-rules";
import { processLifecycleStory, type LifecycleOutcome } from "./task-lifecycle";
import {
  escapeHtml,
  renderCommentEmail,
  renderConsultaEmail,
  renderDeliveryEmail,
  renderEvaluationEmail,
  stageFromEstado,
  type RenderedEmail,
} from "./templates";

/**
 * Entregas: un comentario de Asana que empieza con "ENTREGA NN" + link(s) en
 * una tarea creada desde el correo se envía al solicitante (y CC originales)
 * en el mismo hilo de Gmail. Idempotente por gid de la story; los comentarios
 * del propio usuario de Noma nunca disparan correos.
 */

export type DeliveryOutcome =
  | "sent"
  | "drafted"
  | "skipped_not_comment"
  | "skipped_bot"
  | "skipped_not_delivery"
  | "skipped_no_request"
  | "skipped_duplicate"
  | "rejected_no_links"
  | "scheduled"
  | ClientRelayOutcome
  | LifecycleOutcome;

type Command =
  | {
      kind: "delivery";
      delivery: NonNullable<ReturnType<typeof parseDeliveryCommand>>;
    }
  | {
      kind: "consulta";
      consulta: NonNullable<ReturnType<typeof parseConsultaCommand>>;
    }
  | { kind: "comentario"; comment: CommentCommand }
  | { kind: "evaluacion" }
  | { kind: "cliente"; relay: ClientRelayCommand };

/** Qué hace Noma con una story de Asana (null: nada). Módulo puro. */
export function storyCommand(story: AsanaStory): Command | null {
  if (story.resource_subtype === "comment_added") {
    const relay = parseClientRelayCommand(story.text);
    if (relay) return { kind: "cliente", relay };
    const delivery = parseDeliveryCommand(story.text, story.html_text);
    if (delivery) return { kind: "delivery", delivery };
    const consulta = parseConsultaCommand(story.text);
    if (consulta) return { kind: "consulta", consulta };
    const comment = parseCommentCommand(story.text, story.html_text);
    if (comment && commentCommandActive(story.created_at)) {
      return { kind: "comentario", comment };
    }
    return null;
  }
  if (
    story.resource_subtype === "enum_custom_field_changed" &&
    foldName(story.custom_field?.name ?? "") === foldName(ESTADO_FIELD) &&
    foldName(story.new_enum_value?.name ?? "").startsWith(
      foldName(ESTADO_OUT_OF_SCOPE),
    )
  ) {
    return { kind: "evaluacion" };
  }
  return null;
}

function authorLabel(story: AsanaStory) {
  const name = story.created_by?.name?.trim();
  return name ? name.split(/\s+/).slice(0, 2).join(" ") : null;
}

export async function processAsanaStory(
  storyGid: string,
  options: {
    story?: AsanaStory;
    botUserGid?: string;
    /** Proyecto del webhook que trajo el evento. */
    projectGid?: string | null;
    /**
     * Envío de una entrega o consulta que quedó programada fuera del horario
     * hábil y ya venció (lo llama `flushScheduledDeliveries`).
     */
    dueRun?: boolean;
  } = {},
): Promise<DeliveryOutcome> {
  const botUserGid = options.botUserGid ?? (await resolveBotUserGid());
  const story = options.story ?? (await getStory(storyGid));
  // Asignaciones y cierres hechos por el equipo (no por el bot).
  if (isLifecycleStory(story)) {
    if (!story.created_by || story.created_by.gid === botUserGid) {
      return "skipped_bot";
    }
    return processLifecycleStory(story, { projectGid: options.projectGid });
  }
  if (
    story.resource_subtype !== "comment_added" &&
    story.resource_subtype !== "enum_custom_field_changed"
  ) {
    return "skipped_not_comment";
  }
  if (!story.created_by) return "skipped_bot";
  const command = storyCommand(story);
  // Lo que comenta la cuenta de Noma se ignora (evita loops), salvo «CLIENTE»:
  // el equipo (o un asistente con la cuenta de Noma) registra un mensaje del
  // cliente. Noma nunca escribe comentarios que empiecen con «CLIENTE».
  if (story.created_by.gid === botUserGid && command?.kind !== "cliente") {
    return "skipped_bot";
  }
  if (!command) return "skipped_not_delivery";

  const taskGid = story.target?.gid;
  if (!taskGid) return "skipped_no_request";
  const resolved = await resolveDeliveryRequest(taskGid);
  if (!resolved) return "skipped_no_request";
  const { request, piece } = resolved;
  // Mensaje del cliente por otro canal (WhatsApp, llamada): entra al flujo
  // como una respuesta del hilo (ver client-relay.ts).
  if (command.kind === "cliente") {
    return processClientRelay({
      story,
      relay: command.relay,
      request,
      taskGid,
      piece,
    });
  }
  // La evaluación (fuera de alcance) es de la solicitud completa.
  if (piece && command.kind === "evaluacion") return "skipped_not_delivery";

  const round = command.kind === "delivery" ? command.delivery.round : 0;
  const files =
    command.kind === "delivery"
      ? command.delivery.files
      : command.kind === "comentario"
        ? command.comment.files
        : [];
  // Los ajustes pendientes son de la solicitud completa: una pieza no los
  // da por aplicados (los reparte el equipo entre las subtareas).
  const applied =
    !piece && command.kind === "delivery" && command.delivery.round > 1
      ? (request.emailPendingAdjustments ?? [])
      : [];
  const note =
    command.kind === "delivery"
      ? command.delivery.note
      : command.kind === "consulta"
        ? command.consulta.questions.map((question) => question.text).join("\n")
        : command.kind === "comentario"
          ? command.comment.text
          : null;

  // Reclamo idempotente: una story → un envío. Se reintenta solo si falló.
  const [inserted] = await db
    .insert(requestDeliveries)
    .values({
      clientRequestId: request.id,
      kind: command.kind,
      round,
      asanaStoryGid: story.gid,
      links:
        command.kind === "delivery"
          ? command.delivery.links
          : command.kind === "comentario"
            ? command.comment.links
            : [],
      files,
      appliedAdjustments: applied,
      note,
      status: "sending",
    })
    .onConflictDoNothing({ target: requestDeliveries.asanaStoryGid })
    .returning();
  let delivery = inserted;
  if (!delivery) {
    const [retry] = await db
      .update(requestDeliveries)
      .set({ status: "sending", error: null, updatedAt: new Date() })
      .where(
        // Solo "failed" (Gmail rechazó: no salió) o una programada que ya
        // venció. "sending"/"unknown" pueden haber salido y se dejan para
        // revisión manual para no duplicar.
        and(
          eq(requestDeliveries.asanaStoryGid, story.gid),
          options.dueRun
            ? inArray(requestDeliveries.status, ["failed", "scheduled"])
            : eq(requestDeliveries.status, "failed"),
        ),
      )
      .returning();
    if (!retry) return "skipped_duplicate";
    delivery = retry;
  }

  const channel = await getChannel(request.emailChannelId);
  if (!channel) throw new Error("Canal de correo no encontrado.");
  const padded = formatRound(round);
  const common = {
    folio: request.folio ?? "",
    clientName: channel.clientName,
    alias: channel.alias,
    title: requestTitle(request),
    requesterName: request.requesterName,
  };

  const reject = async (error: string, comment: string) => {
    await db
      .update(requestDeliveries)
      .set({ status: "rejected", error, updatedAt: new Date() })
      .where(eq(requestDeliveries.id, delivery.id));
    await addStory(taskGid, `<body><em>${comment}</em></body>`);
  };

  let rendered: RenderedEmail;
  if (command.kind === "delivery") {
    if (!command.delivery.links.length) {
      await reject(
        "El comentario no trae links.",
        `Noma no envió la Entrega ${padded}: el comentario no trae links. Comenta de nuevo «ENTREGA ${padded}» con el/los link(s), uno por línea como «Nombre: link».`,
      );
      return "rejected_no_links";
    }
    rendered = renderDeliveryEmail({
      ...common,
      round,
      files: command.delivery.files,
      note: command.delivery.note,
      author: authorLabel(story),
      appliedAdjustments: applied.map((item) => item.text),
      pieceLabel: piece?.label ?? (requestTitle(request) || null),
    });
  } else if (command.kind === "consulta") {
    if (!command.consulta.questions.length) {
      await reject(
        "La consulta no trae preguntas.",
        "Noma no envió la consulta: escribe «CONSULTA» y debajo una pregunta por línea.",
      );
      return "rejected_no_links";
    }
    const task = await getTaskState(taskGid).catch(() => null);
    rendered = renderConsultaEmail({
      ...common,
      stage: task
        ? (stageFromEstado(taskFieldValue(task, ESTADO_FIELD)) ?? 1)
        : 1,
      questions: command.consulta.questions,
      blocking: command.consulta.blocking,
      author: authorLabel(story),
    });
  } else if (command.kind === "comentario") {
    if (!command.comment.text && !command.comment.files.length) {
      await reject(
        "El comentario no trae texto.",
        "Noma no envió el comentario: escribe «Comentario» y debajo el texto para el cliente.",
      );
      return "rejected_no_links";
    }
    rendered = renderCommentEmail({
      ...common,
      text: command.comment.text,
      files: command.comment.files,
      author: authorLabel(story),
    });
  } else {
    rendered = renderEvaluationEmail({
      ...common,
      summary:
        request.normalizedSummary?.split(" — ").slice(1).join(" — ") ||
        requestTitle(request),
    });
  }

  const thread = buildReplyThreadHeaders({
    parentMessageId: request.emailLastMessageId ?? request.emailMessageId,
    references: [request.emailMessageId],
  });
  // Entregas y consultas: quien comenta (ejecuta) y el responsable de la
  // tarea (supervisa) quedan en copia del hilo. Degradable: sin Asana, se
  // usan las copias de la solicitud.
  const team =
    command.kind === "evaluacion"
      ? null
      : await studioTeam(taskGid, story.created_by.gid);
  const cc = team
    ? deliveryCc({
        requestCc: request.ccEmails ?? [],
        commenterEmail: team.commenterEmail,
        assigneeEmail: team.assignee?.email ?? null,
        studioDomain: studioDomain(),
        exclude: [request.requesterEmail, channel.alias],
      })
    : (request.ccEmails ?? []);
  const message = {
    threadId: request.emailThreadId!,
    from: { name: STUDIO_SENDER_NAME, email: channel.alias },
    to: [request.requesterEmail],
    cc,
    subject: replySubject(request.emailSubject),
    html: rendered.html,
    text: rendered.text,
    inReplyTo: thread.inReplyTo,
    references: thread.references,
  };

  // 07 (fuera de alcance) es comercial: queda como borrador para Sebastián.
  if (command.kind === "evaluacion") {
    try {
      const draft = await createDraftReply(message);
      await db
        .update(requestDeliveries)
        .set({
          status: "drafted",
          sentGmailMessageId: draft.messageId,
          updatedAt: new Date(),
        })
        .where(eq(requestDeliveries.id, delivery.id));
    } catch (error) {
      const definite =
        error instanceof GmailApiError && isDefiniteRejection(error.status);
      await db
        .update(requestDeliveries)
        .set({
          status: definite ? "failed" : "unknown",
          error: error instanceof Error ? error.message.slice(0, 500) : "Error",
          updatedAt: new Date(),
        })
        .where(eq(requestDeliveries.id, delivery.id));
      throw error;
    }
    await addStory(
      taskGid,
      `<body><em>Noma dejó un borrador del aviso «Solicitud en evaluación» en el hilo de ${escapeHtml(channel.alias)} (casilla de solicitudes). Revísalo, ajústalo si hace falta y envíalo desde Gmail.</em></body>`,
    ).catch((error) => console.error("[email:evaluacion:story]", error));
    return "drafted";
  }

  // Horario hábil (lun–vie 9:00–18:00, Santiago): fuera de él, entregas y
  // consultas quedan programadas para las 08:55 del siguiente día hábil.
  // «ENVIAR AHORA» en el comentario lo salta. Se decide con la hora del
  // comentario, no con la del proceso (la reconciliación puede llegar tarde).
  if (!options.dueRun && !wantsImmediateSend(story.text)) {
    const commentedAt = story.created_at
      ? new Date(story.created_at)
      : new Date();
    const sendAt = deferredSendAt(commentedAt, businessHoursFromEnv());
    if (sendAt && sendAt.getTime() > Date.now()) {
      await db
        .update(requestDeliveries)
        .set({ status: "scheduled", updatedAt: new Date() })
        .where(eq(requestDeliveries.id, delivery.id));
      const what =
        command.kind === "delivery"
          ? `la Entrega ${padded}`
          : command.kind === "comentario"
            ? "el comentario"
            : "la consulta";
      await addStory(
        taskGid,
        `<body><em>Fuera del horario hábil (lunes a viernes, 9:00 a 18:00): Noma enviará ${what} al cliente ${escapeHtml(formatBusinessSlot(sendAt))}. Para enviarla de inmediato, escribe «ENVIAR AHORA» en el comentario de la entrega.</em></body>`,
      ).catch((error) => console.error("[email:delivery:scheduled]", error));
      return "scheduled";
    }
  }

  let sent: Awaited<ReturnType<typeof sendReply>>;
  try {
    sent = await sendReply(message);
  } catch (error) {
    // Solo un 4xx garantiza que no salió; 5xx/red pudo haber salido.
    const definite =
      error instanceof GmailApiError && isDefiniteRejection(error.status);
    await db
      .update(requestDeliveries)
      .set({
        // Rechazo definitivo → reintentable. Corte ambiguo → revisión manual.
        status: definite ? "failed" : "unknown",
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Error de envío",
        updatedAt: new Date(),
      })
      .where(eq(requestDeliveries.id, delivery.id));
    throw error;
  }

  const now = new Date();
  await db
    .update(requestDeliveries)
    .set({
      status: "sent",
      sentAt: now,
      sentGmailMessageId: sent.id,
      updatedAt: now,
    })
    .where(eq(requestDeliveries.id, delivery.id));
  await db
    .update(clientRequests)
    .set({
      emailLastMessageId: sent.messageId ?? request.emailLastMessageId,
      // El equipo que entró en copia sigue en el hilo para el seguimiento.
      ccEmails: cc,
      // Los ajustes pendientes quedan registrados en esta entrega (solo si
      // es de la solicitud completa, no de una pieza).
      ...(command.kind === "delivery" && !piece
        ? { emailPendingAdjustments: [] }
        : {}),
      updatedAt: now,
    })
    .where(eq(clientRequests.id, request.id));

  // Sin responsable: queda asignada a quien hizo la entrega o la consulta.
  if (team && !team.assignee) {
    await setTaskAssignee(taskGid, story.created_by.gid).catch((error) =>
      console.error("[email:delivery:assignee]", error),
    );
  }

  if (command.kind === "consulta") {
    await logActivity({
      entityType: "client_request",
      entityId: request.id,
      action: "email_consulta_sent",
    });
    return "sent";
  }

  // Comentario: llega al hilo sin mover el Estado ni la ronda de entrega.
  if (command.kind === "comentario") {
    await addStory(
      taskGid,
      `<body><em>Noma envió el comentario al cliente en el hilo de la solicitud (para: ${escapeHtml(request.requesterEmail)}${cc.length ? `; copia: ${escapeHtml(cc.join(", "))}` : ""}).</em></body>`,
    ).catch((error) => console.error("[email:comentario:story]", error));
    await logActivity({
      entityType: "client_request",
      entityId: request.id,
      action: "email_comment_sent",
    });
    return "sent";
  }

  // Pasos posteriores degradables: el correo ya salió. Estado y rondas van en
  // la tarea comentada: con piezas, la subtarea (la solicitud no se mueve
  // porque otras piezas pueden seguir en curso).
  if (piece) {
    // Respaldo: campos de la pieza completos y sin duplicado en el listado.
    await syncPiece(taskGid).catch((error) =>
      console.error("[email:delivery:pieza]", error),
    );
  }
  await setEnumFieldByName(
    taskGid,
    channel.asanaProjectGid,
    ESTADO_FIELD,
    ESTADO_SENT,
  ).catch((error) => console.error("[email:delivery:estado]", error));
  // Retrabajo: la ronda enviada queda en el campo numérico del tablero
  // («Rondas de entrega»), que el panel de Métricas promedia por mes.
  await setNumberFieldByName(
    taskGid,
    channel.asanaProjectGid,
    ROUNDS_FIELD,
    round,
  ).catch((error) => console.error("[email:delivery:rondas]", error));
  await addStory(
    taskGid,
    buildDeliveryAuditStoryHtml({
      round: padded,
      to: [request.requesterEmail],
      cc,
    }),
  ).catch((error) => console.error("[email:delivery:story]", error));
  await notifyTeamEvent(
    deliverySentMessage({
      folio: request.folio,
      clientName: channel.clientName,
      round,
      piece: piece?.label ?? null,
      asanaUrl: request.asanaUrl,
    }),
    channel.slackWebhookEnv,
    { projectGid: channel.asanaProjectGid, taskGid },
  );
  await logActivity({
    entityType: "client_request",
    entityId: request.id,
    action: "email_delivery_sent",
  });
  return "sent";
}

/**
 * Envía las entregas y consultas programadas cuyo horario hábil ya llegó.
 * Idempotente: cada fila programada se reclama una vez (`dueRun`). Lo llaman
 * el endpoint `/api/cron/scheduled-deliveries` (a las 08:55), el cron de
 * mantención y, de paso, los webhooks de Asana y Gmail.
 */
export async function flushScheduledDeliveries({
  limit = 20,
  deadline = Date.now() + 40_000,
}: { limit?: number; deadline?: number } = {}) {
  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1_000);
  const rows = await db
    .select({
      storyGid: requestDeliveries.asanaStoryGid,
      createdAt: requestDeliveries.createdAt,
    })
    .from(requestDeliveries)
    .where(
      and(
        eq(requestDeliveries.status, "scheduled"),
        gt(requestDeliveries.createdAt, since),
      ),
    )
    .orderBy(requestDeliveries.createdAt)
    .limit(100);
  const hours = businessHoursFromEnv();
  const due = rows
    .filter((row) => {
      const at = deferredSendAt(row.createdAt, hours);
      return !at || at.getTime() <= Date.now();
    })
    .slice(0, limit);
  if (!due.length) return { scheduled: rows.length, sent: 0, failed: 0 };
  const botUserGid = await resolveBotUserGid();
  let sent = 0;
  let failed = 0;
  for (const row of due) {
    if (Date.now() > deadline) break;
    try {
      const outcome = await processAsanaStory(row.storyGid, {
        botUserGid,
        dueRun: true,
      });
      if (outcome === "sent") sent += 1;
    } catch (error) {
      failed += 1;
      console.error("[email:delivery:flush]", error);
    }
  }
  return { scheduled: rows.length, sent, failed };
}

type EmailRequest = typeof clientRequests.$inferSelect;
type UsableRequest = EmailRequest & {
  emailChannelId: string;
  requesterEmail: string;
};

async function findEmailRequestByTask(taskGid: string) {
  return db.query.clientRequests.findFirst({
    where: and(
      eq(clientRequests.channel, "email"),
      eq(clientRequests.asanaTaskGid, taskGid),
      isNotNull(clientRequests.emailThreadId),
    ),
  });
}

/**
 * Solicitud de correo de la tarea comentada. Si la tarea es una subtarea
 * (una pieza que el equipo separó de la solicitud), sube a la tarea madre:
 * la entrega sale en el mismo hilo, con el nombre de la subtarea como pieza.
 */
async function resolveDeliveryRequest(taskGid: string): Promise<{
  request: UsableRequest;
  piece: { taskGid: string; label: string } | null;
} | null> {
  const usable = (row: EmailRequest | undefined): row is UsableRequest =>
    Boolean(row?.emailChannelId && row.requesterEmail);
  const direct = await findEmailRequestByTask(taskGid);
  if (direct) return usable(direct) ? { request: direct, piece: null } : null;
  // Pieza (subtarea) o etapa de una pieza: sube hasta la solicitud.
  const owner = await findRequestAncestor(taskGid);
  if (!owner) return null;
  const parent = await findEmailRequestByTask(owner.requestTaskGid);
  if (!usable(parent)) return null;
  return {
    request: parent,
    piece: {
      taskGid,
      label: owner.piece.label ?? (requestTitle(parent) || "la pieza"),
    },
  };
}

/** Correo de quien comenta y responsable de la tarea (null si Asana falla). */
async function studioTeam(taskGid: string, commenterGid: string) {
  try {
    const [commenterEmail, assignee] = await Promise.all([
      getUserEmail(commenterGid).catch(() => null),
      getTaskAssignee(taskGid),
    ]);
    return { commenterEmail, assignee };
  } catch (error) {
    console.error("[email:delivery:team]", error);
    return null;
  }
}

/**
 * Respaldo de webhooks perdidos: revisa los comentarios de tareas ligadas a
 * solicitudes de correo con actividad reciente y procesa las ENTREGA que no
 * tengan registro (o cuyo envío falló).
 */
export async function reconcileAsanaDeliveries({
  days = 45,
  limit = 40,
  deadline = Date.now() + 40_000,
}: { days?: number; limit?: number; deadline?: number } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
  const requests = await db
    .select({ id: clientRequests.id, taskGid: clientRequests.asanaTaskGid })
    .from(clientRequests)
    .where(
      and(
        eq(clientRequests.channel, "email"),
        isNotNull(clientRequests.asanaTaskGid),
        gt(clientRequests.updatedAt, since),
      ),
    )
    .orderBy(desc(clientRequests.updatedAt))
    .limit(limit);
  if (!requests.length) return { checked: 0, sent: 0, failed: 0 };

  const botUserGid = await resolveBotUserGid();
  const known = await db
    .select({
      storyGid: requestDeliveries.asanaStoryGid,
      status: requestDeliveries.status,
    })
    .from(requestDeliveries)
    .where(
      inArray(
        requestDeliveries.clientRequestId,
        requests.map((request) => request.id),
      ),
    );
  const settled = new Set(
    known.filter((row) => row.status !== "failed").map((row) => row.storyGid),
  );

  let checked = 0;
  let sent = 0;
  let failed = 0;
  for (const request of requests) {
    if (Date.now() > deadline) break;
    checked += 1;
    // Las piezas (subtareas) y sus etapas entregan en sus propios
    // comentarios: se revisan dos niveles bajo la solicitud.
    const pieces = await listSubtasks(request.taskGid!).catch(() => []);
    const stages = (
      await Promise.all(
        pieces.map((piece) => listSubtasks(piece.gid).catch(() => [])),
      )
    ).flat();
    const stories = (
      await Promise.all(
        [request.taskGid!, ...pieces, ...stages]
          .map((task) => (typeof task === "string" ? task : task.gid))
          .map((gid) => listTaskStories(gid).catch(() => [])),
      )
    ).flat();
    for (const story of stories) {
      const command = storyCommand(story);
      if (
        settled.has(story.gid) ||
        !command ||
        (story.created_by?.gid === botUserGid && command.kind !== "cliente")
      ) {
        continue;
      }
      try {
        const outcome = await processAsanaStory(story.gid, {
          story,
          botUserGid,
        });
        if (outcome === "sent") sent += 1;
      } catch (error) {
        failed += 1;
        console.error("[email:reconcile:asana]", story.gid, error);
      }
    }
  }
  return { checked, sent, failed };
}

/** Entregas trabadas en "sending" (> 15 min) pasan a revisión manual. */
export async function flagStuckDeliveries() {
  const stuck = await db
    .update(requestDeliveries)
    .set({ status: "unknown", updatedAt: new Date() })
    .where(
      and(
        eq(requestDeliveries.status, "sending"),
        lt(requestDeliveries.updatedAt, sql`now() - interval '15 minutes'`),
      ),
    )
    .returning({ id: requestDeliveries.id });
  return stuck.length;
}
