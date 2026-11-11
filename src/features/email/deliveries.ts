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
  listTaskStories,
  resolveBotUserGid,
  setEnumFieldByName,
  setTaskAssignee,
  taskFieldValue,
  type AsanaStory,
} from "@/features/asana/asana";
import { foldName } from "@/features/asana/custom-fields";
import { logActivity } from "@/lib/activity";
import { buildDeliveryAuditStoryHtml } from "./asana-content";
import {
  formatRound,
  parseConsultaCommand,
  parseDeliveryCommand,
} from "./delivery-command";
import { deliveryCc } from "./delivery-team";
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
  escapeHtml,
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
  | "rejected_no_links";

type Command =
  | {
      kind: "delivery";
      delivery: NonNullable<ReturnType<typeof parseDeliveryCommand>>;
    }
  | {
      kind: "consulta";
      consulta: NonNullable<ReturnType<typeof parseConsultaCommand>>;
    }
  | { kind: "evaluacion" };

/** Qué hace Noma con una story de Asana (null: nada). Módulo puro. */
export function storyCommand(story: AsanaStory): Command | null {
  if (story.resource_subtype === "comment_added") {
    const delivery = parseDeliveryCommand(story.text, story.html_text);
    if (delivery) return { kind: "delivery", delivery };
    const consulta = parseConsultaCommand(story.text);
    if (consulta) return { kind: "consulta", consulta };
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
  options: { story?: AsanaStory; botUserGid?: string } = {},
): Promise<DeliveryOutcome> {
  const botUserGid = options.botUserGid ?? (await resolveBotUserGid());
  const story = options.story ?? (await getStory(storyGid));
  if (
    story.resource_subtype !== "comment_added" &&
    story.resource_subtype !== "enum_custom_field_changed"
  ) {
    return "skipped_not_comment";
  }
  if (!story.created_by || story.created_by.gid === botUserGid) {
    return "skipped_bot";
  }
  const command = storyCommand(story);
  if (!command) return "skipped_not_delivery";

  const taskGid = story.target?.gid;
  if (!taskGid) return "skipped_no_request";
  const request = await db.query.clientRequests.findFirst({
    where: and(
      eq(clientRequests.channel, "email"),
      eq(clientRequests.asanaTaskGid, taskGid),
      isNotNull(clientRequests.emailThreadId),
    ),
  });
  if (!request?.emailChannelId || !request.requesterEmail) {
    return "skipped_no_request";
  }

  const round = command.kind === "delivery" ? command.delivery.round : 0;
  const files = command.kind === "delivery" ? command.delivery.files : [];
  const applied =
    command.kind === "delivery" && command.delivery.round > 1
      ? (request.emailPendingAdjustments ?? [])
      : [];
  const note =
    command.kind === "delivery"
      ? command.delivery.note
      : command.kind === "consulta"
        ? command.consulta.questions.map((question) => question.text).join("\n")
        : null;

  // Reclamo idempotente: una story → un envío. Se reintenta solo si falló.
  const [inserted] = await db
    .insert(requestDeliveries)
    .values({
      clientRequestId: request.id,
      kind: command.kind,
      round,
      asanaStoryGid: story.gid,
      links: command.kind === "delivery" ? command.delivery.links : [],
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
        // Solo "failed" (Gmail rechazó: no salió). "sending"/"unknown" pueden
        // haber salido y se dejan para revisión manual para no duplicar.
        and(
          eq(requestDeliveries.asanaStoryGid, story.gid),
          eq(requestDeliveries.status, "failed"),
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
      pieceLabel: requestTitle(request) || null,
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
      // Los ajustes pendientes quedan registrados en esta entrega.
      ...(command.kind === "delivery" ? { emailPendingAdjustments: [] } : {}),
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

  // Pasos posteriores degradables: el correo ya salió.
  await setEnumFieldByName(
    taskGid,
    channel.asanaProjectGid,
    ESTADO_FIELD,
    ESTADO_SENT,
  ).catch((error) => console.error("[email:delivery:estado]", error));
  await addStory(
    taskGid,
    buildDeliveryAuditStoryHtml({
      round: padded,
      to: [request.requesterEmail],
      cc,
    }),
  ).catch((error) => console.error("[email:delivery:story]", error));
  await logActivity({
    entityType: "client_request",
    entityId: request.id,
    action: "email_delivery_sent",
  });
  return "sent";
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
    const stories = await listTaskStories(request.taskGid!);
    for (const story of stories) {
      if (
        settled.has(story.gid) ||
        story.created_by?.gid === botUserGid ||
        !storyCommand(story)
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
