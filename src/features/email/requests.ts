import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clientRequests } from "@/db/schema";
import {
  AsanaApiError,
  addStory,
  createTask,
  ensureMonthSection,
  getTaskState,
  resolveEnumValues,
  setEnumFieldByName,
  setTaskCompleted,
  uploadAttachment,
} from "@/features/asana/asana";
import { notifyNewClientRequest } from "@/features/bot/notify";
import { classifyScope } from "@/features/bot/scope";
import { consumeRequest } from "@/features/retainers/periods";
import { logActivity } from "@/lib/activity";
import { getLLMProvider } from "@/lib/ai/provider";
import { domainOf, externalRecipients } from "./addresses";
import {
  buildReplyStoryHtml,
  buildTaskHtmlNotes,
  priorityLabel,
} from "./asana-content";
import {
  extractEmailRequest,
  type EmailExtraction,
  type StructuredGenerator,
} from "./extract";
import { replySubject } from "./folio";
import { GmailApiError, getAttachment, sendReply } from "./inbox";
import {
  buildReplyThreadHeaders,
  htmlToText,
  stripHtmlQuote,
  type EmailAttachmentRef,
  type ParsedEmail,
} from "./mime";
import { stripQuotedReplyDetailed, type StrippedReply } from "./quote-strip";
import {
  isTrustedSender,
  nextFolio,
  patchEventPayload,
  type EmailRequestRow,
  type ResolvedEmailChannel,
} from "./store";
import { renderConfirmationEmail } from "./templates";

/** Progreso guardado en email_inbound_events.payload para reintentos. */
export type EventProgress = {
  threadId?: string;
  labelIds?: string[];
  extraction?: EmailExtraction;
  extractionSource?: "llm" | "fallback";
  requestId?: string;
  /** Este evento insertó la solicitud (y es dueño de su confirmación). */
  createdRequest?: boolean;
  /** La confirmación salió (Gmail respondió OK) en este evento. */
  confirmationSent?: boolean;
  /** Adjuntos del correo original ya procesados en la tarea. */
  attachmentsDone?: boolean;
  storyGid?: string;
  uploaded?: string[];
};

export const STUDIO_SENDER_NAME = "Studio Nomade";

// Opciones de "Estado" en Asana (se usan solo si existen en el proyecto).
export const ESTADO_FIELD = "Estado";
export const ESTADO_SENT = ["Enviado a cliente"];
export const ESTADO_ADJUSTMENTS = ["Con ajustes"];
const PRIORITY_FIELD = "Prioridad";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const MIN_INLINE_IMAGE_BYTES = 20 * 1024; // logos de firma
/** Tope de destinatarios en copia de confirmaciones y entregas. */
export const MAX_REPLY_CC = 10;

export function emailSourceKey(email: ParsedEmail) {
  return `email:${email.messageId ?? `gmail:${email.gmailId}`}`;
}

export function studioDomain() {
  return (
    process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase() ||
    "studionomade.cl"
  );
}

function structuredGenerator(): StructuredGenerator | null {
  if (!process.env.OPENAI_API_KEY?.trim()) return null;
  return (input) => getLLMProvider().generateStructured(input);
}

/**
 * Cuerpo nuevo de una respuesta, sin citas ni firma. `omitted` avisa que se
 * descartó texto, para que el comentario en Asana lo indique y nadie asuma
 * que eso era todo lo que escribió el cliente.
 */
export function replyBody(email: ParsedEmail): StrippedReply {
  const fromText = stripQuotedReplyDetailed(email.text);
  if (fromText.text || !email.html) return fromText;
  const fromHtml = stripQuotedReplyDetailed(
    htmlToText(stripHtmlQuote(email.html)),
  );
  return { text: fromHtml.text, omitted: true };
}

function selectAttachments(refs: EmailAttachmentRef[]) {
  const selected: EmailAttachmentRef[] = [];
  const skipped: string[] = [];
  for (const ref of refs) {
    const isSmallInlineImage =
      ref.mimeType.startsWith("image/") &&
      (ref.inline || ref.contentId) &&
      ref.size < MIN_INLINE_IMAGE_BYTES;
    if (isSmallInlineImage) continue;
    if (ref.size > MAX_ATTACHMENT_BYTES || selected.length >= MAX_ATTACHMENTS) {
      skipped.push(ref.filename);
      continue;
    }
    selected.push(ref);
  }
  return { selected, skipped };
}

/** Sube adjuntos del correo a la tarea (degradable; devuelve los subidos). */
async function uploadEmailAttachments(
  email: ParsedEmail,
  taskGid: string,
  alreadyUploaded: string[] = [],
  onUploaded?: (names: string[]) => Promise<void>,
) {
  const { selected, skipped } = selectAttachments(email.attachments);
  const uploaded = [...alreadyUploaded];
  for (const ref of selected) {
    const key = `${ref.attachmentId ?? ref.filename}:${ref.size}`;
    if (uploaded.includes(key)) continue;
    try {
      const content = ref.inlineData
        ? Buffer.from(ref.inlineData, "base64url")
        : ref.attachmentId
          ? await getAttachment(email.gmailId, ref.attachmentId)
          : null;
      if (!content) continue;
      await uploadAttachment(taskGid, {
        filename: ref.filename,
        mimeType: ref.mimeType,
        content,
      });
      uploaded.push(key);
      await onUploaded?.(uploaded);
    } catch (error) {
      console.error("[email:attachments]", ref.filename, error);
      skipped.push(ref.filename);
    }
  }
  return {
    names: selected.map((ref) => ref.filename),
    skipped,
    uploadedKeys: uploaded,
  };
}

/**
 * ¿El servicio rechazó la operación de forma definitiva (no ocurrió)? Solo los
 * 4xx (incluido 429) y la falta de configuración (0). Un 5xx o un corte de red
 * es ambiguo: la operación pudo completarse igual, así que no se reintenta a
 * ciegas (evita tareas/correos duplicados).
 */
export function isDefiniteRejection(status: number | null | undefined) {
  return (
    status === 0 ||
    (typeof status === "number" && status >= 400 && status < 500)
  );
}

function isDefinite(error: unknown) {
  return (
    (error instanceof AsanaApiError || error instanceof GmailApiError) &&
    isDefiniteRejection(error.status)
  );
}

// ─────────────────────────────────────────────────────────────
// Solicitud nueva
// ─────────────────────────────────────────────────────────────
export type NewEmailRequestResult = {
  requestId: string;
  folio: string;
  created: boolean;
  warnings: string[];
  /** Quedó algo sin confirmar (tarea o correo): el evento va a revisión. */
  needsReview: boolean;
};

/**
 * Destinatarios de las respuestas. El solicitante es el From (ya autenticado);
 * el Reply-To solo se usa si también es remitente autorizado del canal. Si el
 * alias llegó en copia oculta (no figura en To/Cc) se responde solo al
 * solicitante, para no revelar el alias ni reenviar entregas a terceros.
 */
async function resolveRecipients(
  email: ParsedEmail,
  channel: ResolvedEmailChannel,
  ownAddresses: string[],
) {
  const from = email.from!;
  const replyTo = email.replyTo[0];
  const requester =
    replyTo &&
    replyTo.email !== from.email &&
    (await isTrustedSender(channel, replyTo.email))
      ? replyTo
      : from;
  const visible = [...email.to, ...email.cc].map((address) => address.email);
  const aliasVisible = visible.includes(channel.alias.toLowerCase());
  const cc = aliasVisible
    ? externalRecipients(visible, [...ownAddresses, requester.email]).slice(
        0,
        MAX_REPLY_CC,
      )
    : [];
  return { requester, cc, aliasVisible };
}

export async function handleNewEmailRequest(input: {
  eventId: string;
  progress: EventProgress;
  email: ParsedEmail;
  channel: ResolvedEmailChannel;
  ownAddresses: string[];
}): Promise<NewEmailRequestResult> {
  const { email, channel } = input;
  const from = email.from!;
  const sourceKey = emailSourceKey(email);
  const progress: EventProgress = { ...input.progress };
  const warnings: string[] = [];

  // 1) Extracción (persistida en el evento para reanudar sin re-llamar a la IA).
  if (!progress.extraction) {
    const result = await extractEmailRequest(
      {
        subject: email.subject,
        fromName: from.name,
        fromEmail: from.email,
        date: email.date,
        body: email.text,
        attachmentNames: email.attachments.map((item) => item.filename),
        clientName: channel.clientName,
      },
      structuredGenerator(),
    );
    progress.extraction = result.extraction;
    progress.extractionSource = result.source;
    if (result.error) warnings.push(`IA: ${result.error}`);
    await patchEventPayload(input.eventId, progress);
  }
  const extraction = progress.extraction;

  // 2) Solicitud + folio (idempotente por Message-ID).
  let request =
    (await db.query.clientRequests.findFirst({
      where: eq(clientRequests.sourceMessageId, sourceKey),
    })) ?? null;
  let created = false;
  if (!request) {
    const decision = await classifyScope({
      botChannel: { projectId: channel.projectId },
      summary: `${extraction.title}. ${extraction.summary}`,
      date: email.date,
    });
    const recipients = await resolveRecipients(
      email,
      channel,
      input.ownAddresses,
    );
    if (!recipients.aliasVisible) {
      warnings.push("Alias en copia oculta: se responde solo al remitente.");
    }
    const outcome = await db
      .transaction(async (tx) => {
        const folio = await nextFolio(tx, channel.folioPrefix);
        const [row] = await tx
          .insert(clientRequests)
          .values({
            clientId: channel.clientId,
            projectId: channel.projectId,
            channel: "email",
            createdVia: "email",
            sourceMessageId: sourceKey,
            rawText: email.text.slice(0, 50_000) || email.subject,
            normalizedSummary:
              `${extraction.title} — ${extraction.summary}`.slice(0, 2_000),
            scopeClass: decision.scopeClass,
            predictedScopeClass: decision.scopeClass,
            scopeReason: decision.reason,
            retainerPeriodId: decision.retainerPeriodId,
            estimatedUnits:
              decision.estimatedUnits === null
                ? null
                : decision.estimatedUnits.toFixed(2),
            status: "pending",
            emailChannelId: channel.id,
            emailThreadId: email.threadId,
            emailMessageId: email.messageId,
            emailLastMessageId: email.messageId,
            emailSubject: email.subject.slice(0, 500),
            requesterEmail: recipients.requester.email,
            requesterName: recipients.requester.name ?? from.name,
            ccEmails: recipients.cc,
            folio,
          })
          .onConflictDoNothing()
          .returning();
        // Otro worker ganó: se revierte para no consumir el folio.
        if (!row) throw new DuplicateRequestError();
        return { row, inserted: true };
      })
      .catch(async (error) => {
        if (!(error instanceof DuplicateRequestError)) throw error;
        const winner = await db.query.clientRequests.findFirst({
          where: eq(clientRequests.sourceMessageId, sourceKey),
        });
        if (!winner) {
          throw new Error("No se pudo resolver la solicitud idempotente.");
        }
        return { row: winner, inserted: false };
      });
    request = outcome.row;
    created = outcome.inserted;
    progress.requestId = request.id;
    if (created) progress.createdRequest = true;
    await patchEventPayload(input.eventId, progress);

    if (created) {
      await logActivity({
        entityType: "client_request",
        entityId: request.id,
        action: "request_captured",
      });
      if (
        decision.scopeClass === "in_scope" &&
        decision.retainerPeriodId &&
        decision.estimatedUnits
      ) {
        const consumption = await consumeRequest(request.id);
        if (!consumption.ok) {
          const [updated] = await db
            .update(clientRequests)
            .set({
              scopeClass: "additional",
              scopeReason:
                "El alcance coincide, pero el saldo cambió antes de confirmar; se registró como adicional.",
              updatedAt: new Date(),
            })
            .where(eq(clientRequests.id, request.id))
            .returning();
          request = updated ?? request;
        }
      }
    }
  }

  // 3) Tarea en Asana (un único intento externo reclamado).
  let asanaError: unknown = null;
  let needsReview = false;
  if (!request.asanaTaskGid && !request.asanaAttemptedAt) {
    try {
      request = await createAsanaTaskForRequest(request, {
        email,
        channel,
        extraction,
      });
    } catch (error) {
      asanaError = error;
      warnings.push(
        `Asana: ${error instanceof Error ? error.message : "error desconocido"}`,
      );
      // Corte ambiguo (5xx/red): la tarea pudo crearse. No se reintenta.
      if (!isDefinite(error)) needsReview = true;
    }
  } else if (!request.asanaTaskGid) {
    needsReview = true;
    warnings.push(
      "Asana: intento previo sin confirmar; revisar si la tarea existe.",
    );
  }

  // 4) Confirmación en el mismo hilo (aunque Asana haya fallado), ANTES de
  //    subir adjuntos para que un corte por tiempo no la retrase.
  if (!request.emailAcknowledgedAt) {
    try {
      request = await sendConfirmation(request, {
        channel,
        title: extraction.title,
        dueDate: extraction.requested_due_date,
      });
      progress.confirmationSent = true;
      await patchEventPayload(input.eventId, progress);
    } catch (error) {
      if (isDefinite(error)) throw error; // se libera y se reintenta
      needsReview = true;
      warnings.push(
        `Confirmación sin confirmar (${error instanceof Error ? error.message : "corte"}); revisar si llegó al cliente.`,
      );
    }
  } else if (progress.createdRequest && !progress.confirmationSent) {
    // Este evento reclamó la confirmación pero no vio la respuesta de Gmail
    // (proceso cortado o timeout): puede no haber salido.
    needsReview = true;
    warnings.push("Confirmación reclamada sin respuesta de Gmail; revisar.");
  }

  // 5) Adjuntos del correo original (reanudable por clave de adjunto).
  if (request.asanaTaskGid && !progress.attachmentsDone) {
    const uploads = await uploadEmailAttachments(
      email,
      request.asanaTaskGid,
      progress.uploaded,
      async (keys) => {
        progress.uploaded = keys;
        await patchEventPayload(input.eventId, progress);
      },
    );
    if (uploads.skipped.length) {
      warnings.push(`Adjuntos no subidos: ${uploads.skipped.join(", ")}`);
    }
    progress.attachmentsDone = true;
    await patchEventPayload(input.eventId, progress);
  }

  // 6) Espejo en Slack (degradable).
  if (created) {
    await notifyNewClientRequest({
      requestId: request.id,
      clientName: channel.clientName,
      projectName: channel.projectName,
      summary: `[${request.folio}] ${extraction.title} (correo de ${from.email})`,
      scopeClass: request.scopeClass,
      asanaUrl: request.asanaUrl,
    });
  }

  // Asana rechazó de forma definitiva: se reintenta el evento (la
  // confirmación ya quedó marcada y no se reenvía).
  if (asanaError && isDefinite(asanaError)) throw asanaError;
  return {
    requestId: request.id,
    folio: request.folio ?? "",
    created,
    warnings,
    needsReview,
  };
}

class DuplicateRequestError extends Error {}

async function createAsanaTaskForRequest(
  request: EmailRequestRow,
  ctx: {
    email: ParsedEmail;
    channel: ResolvedEmailChannel;
    extraction: EmailExtraction;
  },
): Promise<EmailRequestRow> {
  const { channel, extraction, email } = ctx;
  // Lecturas previas al reclamo: si fallan, no queda un intento colgado.
  const sectionGid =
    channel.sectionStrategy === "fixed"
      ? channel.fixedSectionGid
      : (
          await ensureMonthSection(
            channel.asanaProjectGid,
            email.date,
            channel.monthSectionTemplate,
          )
        ).gid;
  const customFields = await resolveEnumValues(channel.asanaProjectGid, [
    {
      field: PRIORITY_FIELD,
      options:
        extraction.priority === "urgente"
          ? ["Urgente", "Alta"]
          : [priorityLabel(extraction.priority)],
    },
  ]).catch(() => ({}));

  const [claimed] = await db
    .update(clientRequests)
    .set({ asanaAttemptedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(clientRequests.id, request.id),
        isNull(clientRequests.asanaAttemptedAt),
      ),
    )
    .returning();
  if (!claimed) return request;

  const scopeLabel =
    request.scopeClass === "additional"
      ? "SOLICITUD ADICIONAL — fuera del acuerdo mensual"
      : request.scopeClass === "in_scope"
        ? "Dentro del alcance registrado"
        : "Alcance pendiente de revisión";

  let task: { gid: string; url: string | null };
  try {
    task = await createTask({
      projectGid: channel.asanaProjectGid,
      sectionGid,
      name: `[${request.folio}] ${extraction.title}`,
      htmlNotes: buildTaskHtmlNotes({
        folio: request.folio ?? "",
        extraction,
        requesterName: request.requesterName,
        requesterEmail: request.requesterEmail ?? email.from?.email ?? "",
        ccEmails: request.ccEmails ?? [],
        subject: email.subject,
        receivedAt: email.date,
        alias: channel.alias,
        attachmentNames: email.attachments.map((item) => item.filename),
        scopeLabel,
        body: email.text,
      }),
      dueOn: extraction.requested_due_date,
      assigneeGid: channel.defaultAssigneeGid,
      customFields,
    });
  } catch (error) {
    // Rechazo definitivo (4xx de Asana): la tarea no existe → se libera el
    // reclamo para reintentar. 5xx o falla de red ambigua: queda en revisión.
    if (isDefinite(error)) {
      await db
        .update(clientRequests)
        .set({ asanaAttemptedAt: null, updatedAt: new Date() })
        .where(eq(clientRequests.id, request.id));
    }
    throw error;
  }

  const [updated] = await db
    .update(clientRequests)
    .set({
      asanaTaskGid: task.gid,
      asanaUrl: task.url,
      status: "in_asana",
      updatedAt: new Date(),
    })
    .where(eq(clientRequests.id, request.id))
    .returning();
  return updated ?? claimed;
}

async function sendConfirmation(
  request: EmailRequestRow,
  ctx: {
    channel: ResolvedEmailChannel;
    title: string;
    dueDate: string | null;
  },
): Promise<EmailRequestRow> {
  const [claimed] = await db
    .update(clientRequests)
    .set({ emailAcknowledgedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(clientRequests.id, request.id),
        isNull(clientRequests.emailAcknowledgedAt),
      ),
    )
    .returning();
  if (!claimed) return request;

  const rendered = renderConfirmationEmail({
    folio: request.folio ?? "",
    title: ctx.title,
    requesterName: request.requesterName,
    dueDate: ctx.dueDate,
  });
  const thread = buildReplyThreadHeaders({
    parentMessageId: request.emailLastMessageId ?? request.emailMessageId,
    references: [request.emailMessageId],
  });
  try {
    const sent = await sendReply({
      threadId: request.emailThreadId!,
      from: { name: STUDIO_SENDER_NAME, email: ctx.channel.alias },
      to: [request.requesterEmail!],
      cc: request.ccEmails ?? [],
      subject: replySubject(request.emailSubject, request.folio ?? ""),
      html: rendered.html,
      text: rendered.text,
      inReplyTo: thread.inReplyTo,
      references: thread.references,
    });
    const [updated] = await db
      .update(clientRequests)
      .set({
        emailLastMessageId: sent.messageId ?? request.emailLastMessageId,
        updatedAt: new Date(),
      })
      .where(eq(clientRequests.id, request.id))
      .returning();
    return updated ?? claimed;
  } catch (error) {
    // Gmail rechazó el envío (4xx): se libera para reintentar. Si fue un 5xx
    // o un corte de red se conserva la marca para no duplicar la confirmación.
    if (isDefinite(error)) {
      await db
        .update(clientRequests)
        .set({ emailAcknowledgedAt: null, updatedAt: new Date() })
        .where(eq(clientRequests.id, request.id));
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Respuesta del cliente en el hilo → comentario en Asana
// ─────────────────────────────────────────────────────────────
export async function handleEmailReply(input: {
  eventId: string;
  progress: EventProgress;
  email: ParsedEmail;
  request: EmailRequestRow;
  channel: ResolvedEmailChannel | null;
}): Promise<{ status: "done" | "review"; note: string | null }> {
  const { email, request } = input;
  const from = email.from!;
  const progress: EventProgress = { ...input.progress };
  const taskGid = request.asanaTaskGid;
  if (!taskGid) {
    return {
      status: "review",
      note: `Respuesta a ${request.folio ?? request.id} sin tarea en Asana.`,
    };
  }

  const notes: string[] = [];
  if (!progress.storyGid) {
    const uploads = await uploadEmailAttachments(
      email,
      taskGid,
      progress.uploaded,
      async (keys) => {
        progress.uploaded = keys;
        await patchEventPayload(input.eventId, progress);
      },
    );
    if (uploads.skipped.length) {
      notes.push(`Adjuntos no subidos: ${uploads.skipped.join(", ")}`);
    }
    const body = replyBody(email);
    const story = await addStory(
      taskGid,
      buildReplyStoryHtml({
        fromName: from.name,
        fromEmail: from.email,
        receivedAt: email.date,
        text: body.text,
        quoteOmitted: body.omitted,
        attachmentNames: uploads.names,
      }),
    );
    progress.storyGid = story.gid;
    await patchEventPayload(input.eventId, progress);
  }

  // Ajustes del cliente sobre una tarea cerrada: se reabre. Las respuestas
  // internas del estudio en el hilo solo comentan.
  const isInternal = domainOf(from.email) === studioDomain();
  if (!isInternal) {
    const task = await getTaskState(taskGid);
    if (task.completed) {
      await setTaskCompleted(taskGid, false);
      const projectGid =
        input.channel?.asanaProjectGid ?? task.projects?.[0]?.gid ?? null;
      if (projectGid) {
        await setEnumFieldByName(
          taskGid,
          projectGid,
          ESTADO_FIELD,
          ESTADO_ADJUSTMENTS,
        ).catch((error) => {
          notes.push(
            `Estado no actualizado: ${error instanceof Error ? error.message : "error"}`,
          );
          return false;
        });
      }
      notes.push("Tarea reabierta por respuesta del cliente.");
    }
  }

  await db
    .update(clientRequests)
    .set({
      emailLastMessageId: email.messageId ?? request.emailLastMessageId,
      updatedAt: new Date(),
    })
    .where(eq(clientRequests.id, request.id));
  await logActivity({
    entityType: "client_request",
    entityId: request.id,
    action: "email_reply_commented",
  });
  return { status: "done", note: notes.join(" · ") || null };
}
