import "server-only";

import { and, desc, eq, gt, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientRequests, requestDeliveries } from "@/db/schema";
import {
  addStory,
  getStory,
  listTaskStories,
  resolveBotUserGid,
  setEnumFieldByName,
  type AsanaStory,
} from "@/features/asana/asana";
import { logActivity } from "@/lib/activity";
import { buildDeliveryAuditStoryHtml } from "./asana-content";
import { formatRound, parseDeliveryCommand } from "./delivery-command";
import { replySubject } from "./folio";
import { GmailApiError, sendReply } from "./inbox";
import { buildReplyThreadHeaders } from "./mime";
import {
  ESTADO_FIELD,
  ESTADO_SENT,
  STUDIO_SENDER_NAME,
  isDefiniteRejection,
} from "./requests";
import { getChannel } from "./store";
import { renderDeliveryEmail } from "./templates";

/**
 * Entregas: un comentario de Asana que empieza con "ENTREGA NN" + link(s) en
 * una tarea creada desde el correo se envía al solicitante (y CC originales)
 * en el mismo hilo de Gmail. Idempotente por gid de la story; los comentarios
 * del propio usuario de Noma nunca disparan correos.
 */

export type DeliveryOutcome =
  | "sent"
  | "skipped_not_comment"
  | "skipped_bot"
  | "skipped_not_delivery"
  | "skipped_no_request"
  | "skipped_duplicate"
  | "rejected_no_links";

export async function processAsanaStory(
  storyGid: string,
  options: { story?: AsanaStory; botUserGid?: string } = {},
): Promise<DeliveryOutcome> {
  const botUserGid = options.botUserGid ?? (await resolveBotUserGid());
  const story = options.story ?? (await getStory(storyGid));
  if (story.resource_subtype !== "comment_added") return "skipped_not_comment";
  if (!story.created_by || story.created_by.gid === botUserGid) {
    return "skipped_bot";
  }
  const command = parseDeliveryCommand(story.text, story.html_text);
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

  // Reclamo idempotente: una story → un envío. Se reintenta solo si falló.
  const [inserted] = await db
    .insert(requestDeliveries)
    .values({
      clientRequestId: request.id,
      round: command.round,
      asanaStoryGid: story.gid,
      links: command.links,
      note: command.note,
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
  const round = formatRound(command.round);

  if (!command.links.length) {
    await db
      .update(requestDeliveries)
      .set({
        status: "rejected",
        error: "El comentario no trae links.",
        updatedAt: new Date(),
      })
      .where(eq(requestDeliveries.id, delivery.id));
    await addStory(
      taskGid,
      `<body><em>Noma no envió la Entrega ${round}: el comentario no trae links. Comenta de nuevo «ENTREGA ${round}» con el/los link(s).</em></body>`,
    );
    return "rejected_no_links";
  }

  const title =
    request.normalizedSummary?.split(" — ")[0] ?? request.emailSubject ?? "";
  const rendered = renderDeliveryEmail({
    folio: request.folio ?? "",
    round: command.round,
    title,
    links: command.links,
    note: command.note,
    requesterName: request.requesterName,
  });
  const thread = buildReplyThreadHeaders({
    parentMessageId: request.emailLastMessageId ?? request.emailMessageId,
    references: [request.emailMessageId],
  });
  const cc = request.ccEmails ?? [];

  let sent: Awaited<ReturnType<typeof sendReply>>;
  try {
    sent = await sendReply({
      threadId: request.emailThreadId!,
      from: { name: STUDIO_SENDER_NAME, email: channel.alias },
      to: [request.requesterEmail],
      cc,
      subject: replySubject(request.emailSubject, request.folio ?? ""),
      html: rendered.html,
      text: rendered.text,
      inReplyTo: thread.inReplyTo,
      references: thread.references,
    });
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
      updatedAt: now,
    })
    .where(eq(clientRequests.id, request.id));

  // Pasos posteriores degradables: el correo ya salió.
  await setEnumFieldByName(
    taskGid,
    channel.asanaProjectGid,
    ESTADO_FIELD,
    ESTADO_SENT,
  ).catch((error) => console.error("[email:delivery:estado]", error));
  await addStory(
    taskGid,
    buildDeliveryAuditStoryHtml({ round, to: [request.requesterEmail], cc }),
  ).catch((error) => console.error("[email:delivery:story]", error));
  await logActivity({
    entityType: "client_request",
    entityId: request.id,
    action: "email_delivery_sent",
  });
  return "sent";
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
        story.resource_subtype !== "comment_added" ||
        story.created_by?.gid === botUserGid ||
        !parseDeliveryCommand(story.text, story.html_text)
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
