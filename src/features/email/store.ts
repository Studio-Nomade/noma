import "server-only";

import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clientContacts,
  clientRequests,
  clients,
  emailChannels,
  emailInboundEvents,
  emailMailboxState,
  folioCounters,
  projects,
} from "@/db/schema";
import { isAllowedSenderDomain, normalizeEmail } from "./addresses";
import { formatFolio } from "./folio";
import type { HistoryMessage } from "./inbox";

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ── Canales ──────────────────────────────────────────────────
export type ResolvedEmailChannel = typeof emailChannels.$inferSelect & {
  clientName: string;
  projectName: string;
};

export async function listActiveChannels(): Promise<ResolvedEmailChannel[]> {
  const rows = await db
    .select({
      channel: emailChannels,
      clientName: clients.companyName,
      projectName: projects.name,
    })
    .from(emailChannels)
    .innerJoin(clients, eq(emailChannels.clientId, clients.id))
    .innerJoin(projects, eq(emailChannels.projectId, projects.id))
    .where(eq(emailChannels.status, "active"));
  return rows.map((row) => ({
    ...row.channel,
    clientName: row.clientName,
    projectName: row.projectName,
  }));
}

export async function getChannel(
  id: string,
): Promise<ResolvedEmailChannel | null> {
  const [row] = await db
    .select({
      channel: emailChannels,
      clientName: clients.companyName,
      projectName: projects.name,
    })
    .from(emailChannels)
    .innerJoin(clients, eq(emailChannels.clientId, clients.id))
    .innerJoin(projects, eq(emailChannels.projectId, projects.id))
    .where(eq(emailChannels.id, id))
    .limit(1);
  return row
    ? {
        ...row.channel,
        clientName: row.clientName,
        projectName: row.projectName,
      }
    : null;
}

/** Remitente autorizado: dominio del canal o contacto registrado del cliente. */
export async function isTrustedSender(
  channel: Pick<
    typeof emailChannels.$inferSelect,
    "clientId" | "allowedSenderDomains"
  >,
  email: string,
): Promise<boolean> {
  const sender = normalizeEmail(email);
  if (isAllowedSenderDomain(sender, channel.allowedSenderDomains)) return true;
  const [contact] = await db
    .select({ id: clientContacts.id })
    .from(clientContacts)
    .where(
      and(
        eq(clientContacts.clientId, channel.clientId),
        sql`lower(${clientContacts.email}) = ${sender}`,
      ),
    )
    .limit(1);
  return Boolean(contact);
}

// ── Folio correlativo ────────────────────────────────────────
/**
 * Siguiente folio del prefijo. El upsert es atómico y deja la fila bloqueada
 * hasta el commit de `tx`: dos correos simultáneos nunca comparten número y,
 * si la transacción se revierte, el número no se consume.
 */
export async function nextFolio(tx: DbTransaction, prefix: string) {
  const normalized = prefix.trim().toUpperCase();
  const [row] = await tx
    .insert(folioCounters)
    .values({ prefix: normalized, lastNumber: 1 })
    .onConflictDoUpdate({
      target: folioCounters.prefix,
      set: {
        lastNumber: sql`${folioCounters.lastNumber} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ lastNumber: folioCounters.lastNumber });
  return formatFolio(normalized, row.lastNumber);
}

// ── Búsquedas de solicitudes por hilo ────────────────────────
export type EmailRequestRow = typeof clientRequests.$inferSelect;

const emailOnly = eq(clientRequests.channel, "email");

export async function requestByThreadId(threadId: string) {
  return (
    (await db.query.clientRequests.findFirst({
      where: and(emailOnly, eq(clientRequests.emailThreadId, threadId)),
    })) ?? null
  );
}

export async function requestByMessageIds(messageIds: string[]) {
  if (!messageIds.length) return null;
  return (
    (await db.query.clientRequests.findFirst({
      where: and(
        emailOnly,
        or(
          inArray(clientRequests.emailMessageId, messageIds),
          inArray(clientRequests.emailLastMessageId, messageIds),
        ),
      ),
    })) ?? null
  );
}

export async function requestByFolio(folio: string) {
  return (
    (await db.query.clientRequests.findFirst({
      where: and(emailOnly, eq(clientRequests.folio, folio.toUpperCase())),
    })) ?? null
  );
}

export async function requestBySourceKey(sourceKey: string) {
  return (
    (await db.query.clientRequests.findFirst({
      where: eq(clientRequests.sourceMessageId, sourceKey),
    })) ?? null
  );
}

// ── Estado de la casilla (historyId / watch) ─────────────────
export async function getMailboxState(mailbox: string) {
  const [row] = await db
    .select()
    .from(emailMailboxState)
    .where(eq(emailMailboxState.mailbox, mailbox))
    .limit(1);
  return row ?? null;
}

/** Avanza el historyId guardado solo hacia adelante (pushes concurrentes). */
export async function advanceHistoryId(mailbox: string, historyId: string) {
  await db
    .insert(emailMailboxState)
    .values({ mailbox, historyId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: emailMailboxState.mailbox,
      set: {
        historyId: sql`case when ${emailMailboxState.historyId} is null or ${emailMailboxState.historyId}::numeric < ${historyId}::numeric then ${historyId} else ${emailMailboxState.historyId} end`,
        updatedAt: new Date(),
      },
    });
}

export async function saveWatch(
  mailbox: string,
  input: { historyId: string; expiration: Date },
) {
  await db
    .insert(emailMailboxState)
    .values({
      mailbox,
      historyId: input.historyId,
      watchExpiresAt: input.expiration,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: emailMailboxState.mailbox,
      // El historyId existente se conserva: el watch no debe saltarse correos
      // pendientes de sincronizar. `updatedAt` tampoco se toca: marca la
      // última sincronización real y define la ventana del backfill.
      set: { watchExpiresAt: input.expiration },
    });
}

// ── Cola durable ─────────────────────────────────────────────
const SKIPPED_LABELS = new Set(["SENT", "DRAFT", "SPAM", "TRASH", "CHAT"]);

export function isProcessableLabelSet(labelIds: string[]) {
  return !labelIds.some((label) => SKIPPED_LABELS.has(label));
}

export async function enqueueMessages(
  messages: HistoryMessage[],
  historyId: string | null,
) {
  const rows = messages
    .filter((message) => isProcessableLabelSet(message.labelIds))
    .map((message) => ({
      gmailMessageId: message.id,
      gmailHistoryId: historyId,
      payload: { threadId: message.threadId, labelIds: message.labelIds },
    }));
  if (!rows.length) return 0;
  const inserted = await db
    .insert(emailInboundEvents)
    .values(rows)
    .onConflictDoNothing({ target: emailInboundEvents.gmailMessageId })
    .returning({ id: emailInboundEvents.id });
  return inserted.length;
}

/**
 * Un hilo se procesa de a un evento a la vez: si otro worker tiene un mensaje
 * del mismo threadId en curso (lease < 15 min), este no se reclama. Evita que
 * "la solicitud" y "olvidé el adjunto" del mismo hilo creen dos folios.
 */
const threadNotBusy = sql`not exists (
  select 1 from email_inbound_events busy
  where busy.id <> ${emailInboundEvents.id}
    and busy.status = 'processing'
    and busy.updated_at > now() - interval '15 minutes'
    and busy.payload->>'threadId' = ${emailInboundEvents.payload}->>'threadId'
)`;

export async function claimPendingEvents(
  limit: number,
  includeFailed: boolean,
) {
  return db.transaction(async (tx) => {
    // Serializa los reclamos (lock de transacción, compatible con pooler en
    // modo transacción) para que dos workers no tomen el mismo hilo a la vez.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('noma:email-inbound-claim'))`,
    );
    const statusFilter = includeFailed
      ? or(
          eq(emailInboundEvents.status, "pending"),
          and(
            eq(emailInboundEvents.status, "failed"),
            lt(emailInboundEvents.attempts, 5),
          ),
          // Reclamos huérfanos (proceso caído a mitad de camino).
          and(
            eq(emailInboundEvents.status, "processing"),
            lt(emailInboundEvents.attempts, 5),
            lt(
              emailInboundEvents.updatedAt,
              sql`now() - interval '15 minutes'`,
            ),
          ),
        )
      : eq(emailInboundEvents.status, "pending");
    const events = await tx
      .select()
      .from(emailInboundEvents)
      .where(and(statusFilter, threadNotBusy))
      .orderBy(asc(emailInboundEvents.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (!events.length) return [];
    await tx
      .update(emailInboundEvents)
      .set({
        status: "processing",
        attempts: sql`${emailInboundEvents.attempts} + 1`,
        error: null,
        updatedAt: new Date(),
      })
      .where(
        inArray(
          emailInboundEvents.id,
          events.map((event) => event.id),
        ),
      );
    return events;
  });
}

export type EventStatus = "done" | "failed" | "ignored" | "review";

export async function finishEvent(
  id: string,
  status: EventStatus,
  note: string | null,
  payload?: Record<string, unknown>,
) {
  await db
    .update(emailInboundEvents)
    .set({
      status,
      error: note?.slice(0, 500) ?? null,
      ...(payload ? { payload } : {}),
      updatedAt: new Date(),
    })
    .where(eq(emailInboundEvents.id, id));
}

/** Guarda progreso parcial (p. ej. storyGid ya publicado) para reintentos. */
export async function patchEventPayload(
  id: string,
  payload: Record<string, unknown>,
) {
  await db
    .update(emailInboundEvents)
    .set({ payload, updatedAt: new Date() })
    .where(eq(emailInboundEvents.id, id));
}
