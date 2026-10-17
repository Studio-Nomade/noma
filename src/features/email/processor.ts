import "server-only";

import { notifyUnknownEmailSender } from "@/features/bot/notify";
import { logActivity } from "@/lib/activity";
import { matchAlias, routingCandidates } from "./addresses";
import { GmailApiError, getMessage, requestsMailbox } from "./inbox";
import { isAutomatedMessage, parseGmailMessage } from "./mime";
import { detectReply } from "./reply-detection";
import {
  emailSourceKey,
  handleEmailReply,
  handleNewEmailRequest,
  type EventProgress,
} from "./requests";
import {
  claimPendingEvents,
  finishEvent,
  getChannel,
  isProcessableLabelSet,
  isTrustedSender,
  listActiveChannels,
  requestByFolio,
  requestByMessageIds,
  requestByThreadId,
} from "./store";

/**
 * Procesa la cola durable de correos de la casilla de solicitudes.
 *
 * Por cada mensaje: ignora lo enviado por la propia casilla/alias y las
 * respuestas automáticas; si es respuesta a una solicitud (threadId,
 * References o folio) la comenta en Asana; si no, rutea por alias, valida el
 * remitente (dominio autorizado o contacto del cliente) y crea solicitud +
 * tarea + confirmación en el hilo. Remitentes desconocidos quedan en revisión.
 */
export async function processPendingEmails({
  limit = 10,
  includeFailed = false,
}: { limit?: number; includeFailed?: boolean } = {}) {
  const events = await claimPendingEvents(
    Math.max(1, Math.min(limit, 50)),
    includeFailed,
  );
  const results: { id: string; status: string }[] = [];
  for (const event of events) {
    try {
      const outcome = await processEmailEvent(
        event.id,
        event.gmailMessageId,
        (event.payload ?? {}) as EventProgress,
      );
      await finishEvent(event.id, outcome.status, outcome.note);
      results.push({ id: event.id, status: outcome.status });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Error desconocido";
      console.error("[email:processor]", event.gmailMessageId, message);
      await finishEvent(event.id, "failed", message);
      results.push({ id: event.id, status: "failed" });
    }
  }
  return results;
}

type Outcome = {
  status: "done" | "ignored" | "review";
  note: string | null;
};

async function processEmailEvent(
  eventId: string,
  gmailMessageId: string,
  progress: EventProgress,
): Promise<Outcome> {
  let message;
  try {
    message = await getMessage(gmailMessageId);
  } catch (error) {
    if (error instanceof GmailApiError && error.status === 404) {
      return { status: "ignored", note: "El mensaje ya no existe en Gmail." };
    }
    throw error;
  }
  const email = parseGmailMessage(message);
  const channels = await listActiveChannels();
  const ownAddresses = [
    requestsMailbox(),
    ...channels.map((channel) => channel.alias),
  ].filter((value): value is string => Boolean(value));

  // Lo que envía Noma (confirmaciones/entregas) también entra al history.
  if (
    !isProcessableLabelSet(email.labelIds) ||
    !email.from ||
    ownAddresses.includes(email.from.email)
  ) {
    return {
      status: "ignored",
      note: "Enviado por la casilla o sin remitente.",
    };
  }
  if (isAutomatedMessage(email.headers)) {
    return { status: "ignored", note: "Respuesta automática." };
  }

  const sourceKey = emailSourceKey(email);
  const reply = await detectReply(
    {
      threadId: email.threadId,
      subject: email.subject,
      inReplyTo: email.inReplyTo,
      references: email.references,
      fromEmail: email.from.email,
    },
    {
      byThreadId: requestByThreadId,
      byMessageIds: requestByMessageIds,
      byFolio: requestByFolio,
      isTrustedSender: async (candidate, sender) => {
        const channel = candidate.emailChannelId
          ? await getChannel(candidate.emailChannelId)
          : null;
        return channel ? isTrustedSender(channel, sender) : false;
      },
    },
  );

  // El correo que originó la solicitud comparte su threadId: no es respuesta.
  if (reply && reply.request.sourceMessageId !== sourceKey) {
    const channel = reply.request.emailChannelId
      ? (channels.find((item) => item.id === reply.request.emailChannelId) ??
        (await getChannel(reply.request.emailChannelId)))
      : null;
    const result = await handleEmailReply({
      eventId,
      progress,
      email,
      request: reply.request,
      channel,
    });
    return {
      status: result.status,
      note: [`Respuesta (${reply.via}) a ${reply.request.folio}`, result.note]
        .filter(Boolean)
        .join(" · "),
    };
  }

  const alias = matchAlias(
    routingCandidates(email.headers),
    channels.map((channel) => channel.alias),
  );
  const channel = alias
    ? channels.find((item) => item.alias === alias)
    : undefined;
  if (!channel) {
    return {
      status: "ignored",
      note: "No va dirigido a un alias de solicitudes.",
    };
  }

  if (!(await isTrustedSender(channel, email.from.email))) {
    await notifyUnknownEmailSender({
      alias: channel.alias,
      fromEmail: email.from.email,
      subject: email.subject,
      clientName: channel.clientName,
    });
    await logActivity({
      entityType: "email_inbound_event",
      entityId: eventId,
      action: "email_sender_review",
    });
    return {
      status: "review",
      note: `Remitente no autorizado para ${channel.alias}.`,
    };
  }

  const result = await handleNewEmailRequest({
    eventId,
    progress,
    email,
    channel,
    ownAddresses,
  });
  return {
    status: "done",
    note:
      [
        `${result.created ? "Solicitud" : "Reanudada"} ${result.folio}`,
        ...result.warnings,
      ].join(" · ") || null,
  };
}
