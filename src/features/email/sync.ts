import "server-only";

import {
  GmailApiError,
  getProfileHistoryId,
  listHistory,
  requestsMailbox,
  searchMessages,
  watchMailbox,
} from "./inbox";
import {
  advanceHistoryId,
  enqueueMessages,
  getMailboxState,
  saveWatch,
} from "./store";

/**
 * Sincroniza la casilla de solicitudes con la cola durable: lee el history de
 * Gmail desde el último historyId guardado y encola los mensajes nuevos.
 * Lo llaman el push de Pub/Sub y el cron (reconciliación de pushes perdidos).
 */
export async function syncMailboxHistory(
  notificationHistoryId?: string | null,
): Promise<{ enqueued: number; historyId: string | null; backfill: boolean }> {
  const mailbox = requestsMailbox();
  if (!mailbox) throw new GmailApiError("Falta NOMA_REQUESTS_MAILBOX.", 0);
  const labelId = process.env.NOMA_GMAIL_WATCH_LABEL_ID?.trim() || null;
  const state = await getMailboxState(mailbox);

  if (!state?.historyId) {
    // Primera notificación: se fija el punto de partida sin backfill para no
    // duplicar solicitudes ya gestionadas por otro medio.
    if (notificationHistoryId) {
      await advanceHistoryId(mailbox, notificationHistoryId);
    }
    return {
      enqueued: 0,
      historyId: notificationHistoryId ?? null,
      backfill: false,
    };
  }

  try {
    const result = await listHistory(state.historyId, labelId);
    const enqueued = await enqueueMessages(result.messages, result.historyId);
    await advanceHistoryId(mailbox, result.historyId);
    return { enqueued, historyId: result.historyId, backfill: false };
  } catch (error) {
    if (!(error instanceof GmailApiError) || error.status !== 404) throw error;
    // historyId expirado: búsqueda acotada desde la última sincronización.
    // El nuevo punto de partida se toma ANTES de buscar para no perder
    // correos que lleguen entremedio (la cola deduplica los repetidos).
    const restartFrom = notificationHistoryId ?? (await getProfileHistoryId());
    const since = Math.floor(
      Math.max(
        state.updatedAt.getTime() - 60 * 60 * 1_000,
        Date.now() - 7 * 24 * 60 * 60 * 1_000,
      ) / 1_000,
    );
    const messages = await searchMessages(
      `after:${since} -in:sent -in:drafts -in:spam -in:trash`,
      200,
      labelId,
    );
    const enqueued = await enqueueMessages(messages, null);
    await advanceHistoryId(mailbox, restartFrom);
    return { enqueued, historyId: restartFrom, backfill: true };
  }
}

/** Renueva el watch de Gmail (expira a los 7 días). */
export async function renewMailboxWatch() {
  const mailbox = requestsMailbox();
  const topicName = process.env.NOMA_GMAIL_PUBSUB_TOPIC?.trim();
  if (!mailbox || !topicName) {
    return {
      renewed: false,
      reason: "Faltan NOMA_REQUESTS_MAILBOX / NOMA_GMAIL_PUBSUB_TOPIC.",
    };
  }
  const labelId = process.env.NOMA_GMAIL_WATCH_LABEL_ID?.trim();
  const watch = await watchMailbox({
    topicName,
    labelIds: labelId ? [labelId] : undefined,
  });
  await saveWatch(mailbox, watch);
  // Si la casilla aún no tenía punto de partida, el del watch sirve.
  const state = await getMailboxState(mailbox);
  if (!state?.historyId) await advanceHistoryId(mailbox, watch.historyId);
  return { renewed: true, expiration: watch.expiration.toISOString() };
}
