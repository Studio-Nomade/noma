/**
 * ¿Un correo entrante es respuesta a una solicitud existente?
 *
 * Orden: (1) threadId de Gmail, (2) In-Reply-To/References contra los
 * Message-ID guardados, (3) folio en el asunto. El folio es adivinable, así
 * que solo se acepta si el remitente es de confianza para esa solicitud.
 * Las búsquedas se inyectan para mantener este módulo puro y testeable.
 */

import { findFolioInSubject } from "./folio";

export type ReplyCandidate = {
  id: string;
  folio: string | null;
  emailChannelId: string | null;
  requesterEmail: string | null;
  ccEmails: string[] | null;
};

export type ReplyLookups<T extends ReplyCandidate = ReplyCandidate> = {
  byThreadId(threadId: string): Promise<T | null>;
  byMessageIds(messageIds: string[]): Promise<T | null>;
  byFolio(folio: string): Promise<T | null>;
  /** Remitente autorizado para el canal de la solicitud (dominio/contacto). */
  isTrustedSender(candidate: T, senderEmail: string): Promise<boolean>;
};

export type ReplyMatch<T extends ReplyCandidate = ReplyCandidate> = {
  request: T;
  via: "thread" | "references" | "folio";
};

export async function detectReply<T extends ReplyCandidate>(
  email: {
    threadId: string;
    subject: string;
    inReplyTo: string | null;
    references: string[];
    fromEmail: string;
  },
  lookups: ReplyLookups<T>,
): Promise<ReplyMatch<T> | null> {
  const byThread = await lookups.byThreadId(email.threadId);
  if (byThread) return { request: byThread, via: "thread" };

  const ids = [email.inReplyTo, ...email.references].filter(
    (value): value is string => Boolean(value),
  );
  if (ids.length) {
    const byReferences = await lookups.byMessageIds([...new Set(ids)]);
    if (byReferences) return { request: byReferences, via: "references" };
  }

  const folio = findFolioInSubject(email.subject);
  if (!folio) return null;
  const byFolio = await lookups.byFolio(folio);
  if (!byFolio) return null;

  const sender = email.fromEmail.toLowerCase();
  const participants = [
    byFolio.requesterEmail,
    ...(byFolio.ccEmails ?? []),
  ].map((value) => value?.toLowerCase());
  if (
    participants.includes(sender) ||
    (await lookups.isTrustedSender(byFolio, sender))
  ) {
    return { request: byFolio, via: "folio" };
  }
  return null;
}
