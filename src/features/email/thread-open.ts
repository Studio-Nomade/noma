import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clientRequests } from "@/db/schema";
import {
  addStory,
  getTaskForThread,
  listModifiedTaskGids,
  resolveCustomFieldValues,
  setTaskCustomFields,
  setTaskName,
  taskFieldValue,
} from "@/features/asana/asana";
import { notifyNewClientRequest } from "@/features/bot/notify";
import { logActivity } from "@/lib/activity";
import { completeExtraction } from "./extract";
import { GmailApiError, sendReply } from "./inbox";
import { STUDIO_SENDER_NAME, isDefiniteRejection } from "./requests";
import {
  activeChannelByProject,
  contactName,
  isTrustedSender,
  nextFolio,
} from "./store";
import { escapeHtml, renderConfirmationEmail } from "./templates";
import {
  CONTACT_FIELD,
  contactEmailFrom,
  decideThreadOpen,
  openedSubject,
  openedTaskName,
  summaryFromNotes,
  taskSourceKey,
  threadOpenSince,
} from "./thread-open-rules";

export type ThreadOpenOutcome =
  | "abierto"
  | "folio"
  | "sin_canal"
  | "ya_existe"
  | "no_autorizado"
  | "subtarea"
  | "completada"
  | "con_folio"
  | "sin_titulo"
  | "anterior"
  | "error";

class DuplicateOpenError extends Error {}

type RequestRow = typeof clientRequests.$inferSelect;

/**
 * Abre el hilo de correo de una tarea creada en un proyecto con canal
 * (modelo A): registra la solicitud con folio, le envía al «Correo de
 * contacto» «Solicitud registrada · [FOLIO] Título» desde el alias del canal
 * y renombra la tarea «[FOLIO] Título». Idempotente por tarea; si el correo
 * no salió, un reintento lo vuelve a intentar sin crear otra solicitud.
 * `announce`: comenta en la tarea por qué no se abrió (contacto no
 * autorizado), solo en los disparos del webhook (no en la reconciliación).
 */
export async function openThreadForTask(input: {
  taskGid: string;
  projectGid: string;
  announce?: boolean;
}): Promise<ThreadOpenOutcome> {
  try {
    const channel = await activeChannelByProject(input.projectGid);
    if (!channel) return "sin_canal";

    const sourceKey = taskSourceKey(input.taskGid);
    const existing = await db.query.clientRequests.findFirst({
      where: eq(clientRequests.asanaTaskGid, input.taskGid),
    });
    // Solicitud del flujo de correo, o ya con hilo: nada que hacer.
    if (
      existing &&
      (existing.sourceMessageId !== sourceKey || existing.emailThreadId)
    ) {
      return "ya_existe";
    }

    const task = await getTaskForThread(input.taskGid);
    const contact = contactEmailFrom(taskFieldValue(task, CONTACT_FIELD));
    const trusted = contact ? await isTrustedSender(channel, contact) : false;
    if (contact && !trusted && input.announce) {
      await addStory(
        input.taskGid,
        `<body><em>Noma no abrió el hilo de correo: ${escapeHtml(contact)} no es un contacto registrado de ${escapeHtml(channel.clientName)} ni de un dominio permitido del canal. Agrégalo como contacto del cliente en Noma y vuelve a guardar el «${CONTACT_FIELD}».</em></body>`,
      ).catch((error) => console.error("[email:hilo:story]", error));
    }

    // Ya registrada (con folio) sin hilo: se abre cuando llega el contacto.
    if (existing) {
      if (!trusted || !contact) return contact ? "no_autorizado" : "folio";
      const requesterName = await contactName(channel.clientId, contact).catch(
        () => null,
      );
      const [updated] = await db
        .update(clientRequests)
        .set({ requesterEmail: contact, requesterName, updatedAt: new Date() })
        .where(eq(clientRequests.id, existing.id))
        .returning();
      return (await sendOpening(updated ?? existing, channel, input.taskGid))
        ? "abierto"
        : "error";
    }

    const decision = decideThreadOpen({
      name: task.name,
      completed: Boolean(task.completed),
      isSubtask: Boolean(task.parent?.gid),
      contactField: taskFieldValue(task, CONTACT_FIELD),
      createdAt: task.created_at,
      since: threadOpenSince(),
    });
    if (!decision.open) return decision.reason;

    const now = new Date();
    const requesterEmail = trusted ? contact : null;
    const requesterName = requesterEmail
      ? await contactName(channel.clientId, requesterEmail).catch(() => null)
      : null;
    const summary = summaryFromNotes(task.notes) || decision.title;
    const request = await db
      .transaction(async (tx) => {
        const folio = await nextFolio(tx, channel.folioPrefix, now);
        const [row] = await tx
          .insert(clientRequests)
          .values({
            clientId: channel.clientId,
            projectId: channel.projectId,
            channel: "email",
            createdVia: "asana",
            sourceMessageId: sourceKey,
            rawText: task.notes?.slice(0, 50_000) || decision.title,
            normalizedSummary: `${decision.title} — ${summary}`.slice(0, 2_000),
            status: "in_asana",
            emailChannelId: channel.id,
            emailSubject: openedSubject(folio, decision.title),
            requesterEmail,
            requesterName,
            ccEmails: channel.alwaysCc ?? [],
            folio,
            asanaTaskGid: input.taskGid,
            asanaUrl: task.permalink_url ?? null,
            asanaAttemptedAt: now,
          })
          .onConflictDoNothing()
          .returning();
        // Otro disparo ganó: se revierte para no consumir el folio.
        if (!row) throw new DuplicateOpenError();
        return row;
      })
      .catch((error) => {
        if (error instanceof DuplicateOpenError) return null;
        throw error;
      });
    if (!request) return "ya_existe";

    await logActivity({
      entityType: "client_request",
      entityId: request.id,
      action: "request_captured",
    });

    // La tarea queda con la nomenclatura vigente y el folio en su campo.
    await setTaskName(
      input.taskGid,
      openedTaskName(request.folio!, decision.title),
    ).catch((error) => console.error("[email:hilo:nombre]", error));
    const fields = await resolveCustomFieldValues(channel.asanaProjectGid, [
      { kind: "text", fields: ["Folio NOMA", "Folio"], value: request.folio! },
    ]).catch(() => ({}));
    await setTaskCustomFields(input.taskGid, fields).catch((error) =>
      console.error("[email:hilo:folio]", error),
    );
    // Aviso de solicitud nueva en el hilo de Slack del proyecto.
    await notifyNewClientRequest({
      requestId: request.id,
      slackWebhookEnv: channel.slackWebhookEnv,
      clientName: channel.clientName,
      projectName: channel.projectName,
      summary: decision.title,
      asanaUrl: request.asanaUrl,
      folio: request.folio,
      requester: request.requesterName
        ? `${request.requesterName} (${request.requesterEmail})`
        : request.requesterEmail,
      thread: { projectGid: channel.asanaProjectGid, taskGid: input.taskGid },
    }).catch((error) => console.error("[email:hilo:slack]", error));

    if (!requesterEmail) {
      await addStory(
        input.taskGid,
        `<body><em>Noma asignó el folio ${escapeHtml(request.folio ?? "")}. Para escribirle al cliente (entregas, consultas y comentarios por correo), completa «${CONTACT_FIELD}»: Noma abre el hilo en ese momento.</em></body>`,
      ).catch((error) => console.error("[email:hilo:story]", error));
      return contact ? "no_autorizado" : "folio";
    }
    return (await sendOpening(request, channel, input.taskGid))
      ? "abierto"
      : "error";
  } catch (error) {
    console.error("[email:hilo]", input.taskGid, error);
    return "error";
  }
}

/** Envía «Solicitud registrada» (abre el hilo) y lo deja anotado. */
async function sendOpening(
  request: RequestRow,
  channel: NonNullable<Awaited<ReturnType<typeof activeChannelByProject>>>,
  taskGid: string,
): Promise<boolean> {
  // Reclamo: un solo envío aunque lleguen dos disparos a la vez. Una marca
  // previa (envío ambiguo) queda para revisión manual: no se duplica.
  const [claimed] = await db
    .update(clientRequests)
    .set({ emailAcknowledgedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(clientRequests.id, request.id),
        isNull(clientRequests.emailAcknowledgedAt),
        isNull(clientRequests.emailThreadId),
      ),
    )
    .returning();
  if (!claimed) return false;

  const title =
    request.normalizedSummary?.split(" — ")[0] ?? request.emailSubject ?? "";
  const summary =
    request.normalizedSummary?.split(" — ").slice(1).join(" — ") || title;
  const rendered = renderConfirmationEmail({
    folio: request.folio ?? "",
    clientName: channel.clientName,
    alias: channel.alias,
    title,
    requesterName: request.requesterName,
    requesterEmail: request.requesterEmail!,
    extraction: completeExtraction({ title, summary }),
    receivedAt: request.createdAt,
    via: "Equipo Studio Nomade",
  });
  try {
    const sent = await sendReply({
      threadId: null,
      from: { name: STUDIO_SENDER_NAME, email: channel.alias },
      to: [request.requesterEmail!],
      cc: request.ccEmails ?? [],
      subject:
        request.emailSubject ?? openedSubject(request.folio ?? "", title),
      html: rendered.html,
      text: rendered.text,
      inReplyTo: null,
      references: [],
    });
    await db
      .update(clientRequests)
      .set({
        emailThreadId: sent.threadId,
        emailMessageId: sent.messageId,
        emailLastMessageId: sent.messageId,
        updatedAt: new Date(),
      })
      .where(eq(clientRequests.id, request.id));
  } catch (error) {
    // Rechazo definitivo (4xx): se libera para reintentar. Un corte ambiguo
    // conserva la marca para no duplicar el correo (queda para revisión).
    const definite =
      error instanceof GmailApiError && isDefiniteRejection(error.status);
    if (definite) {
      await db
        .update(clientRequests)
        .set({ emailAcknowledgedAt: null, updatedAt: new Date() })
        .where(eq(clientRequests.id, request.id));
    }
    console.error("[email:hilo:envio]", request.id, error);
    return false;
  }

  await addStory(
    taskGid,
    `<body><em>Noma abrió el hilo de correo con ${escapeHtml(request.requesterEmail ?? "")}: «${escapeHtml(request.emailSubject ?? "")}», desde ${escapeHtml(channel.alias)}. Desde ahora ENTREGA, CONSULTA, COMENTARIO y CLIENTE van en ese hilo.</em></body>`,
  ).catch((error) => console.error("[email:hilo:story]", error));
  return true;
}

/**
 * Red de seguridad: tareas recientes de los proyectos con canal que tienen
 * «Correo de contacto» y aún no tienen hilo (webhook perdido o correo que no
 * salió). Las reglas de apertura (fecha de corte, folio, contacto) se
 * aplican igual.
 */
export async function reconcileThreadOpenings(input: {
  projectGids: string[];
  hours?: number;
  deadline?: number;
}) {
  const since = new Date(Date.now() - (input.hours ?? 48) * 60 * 60 * 1000);
  const result = { checked: 0, opened: 0 };
  for (const projectGid of input.projectGids) {
    if (input.deadline && Date.now() > input.deadline) break;
    const taskGids = await listModifiedTaskGids(projectGid, since).catch(
      () => [],
    );
    for (const taskGid of taskGids) {
      if (input.deadline && Date.now() > input.deadline) break;
      result.checked += 1;
      if ((await openThreadForTask({ taskGid, projectGid })) === "abierto") {
        result.opened += 1;
      }
    }
  }
  return result;
}
