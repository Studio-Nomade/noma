import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clientRequests, requestDeliveries } from "@/db/schema";
import {
  AsanaApiError,
  addStory,
  createTask,
  ensureMonthSection,
  getTaskState,
  resolveCustomFieldValues,
  setEnumFieldByName,
  setTaskCompleted,
  setTaskCustomFields,
  setTaskDueOn,
  taskFieldValue,
  uploadAttachment,
} from "@/features/asana/asana";
import type { CustomFieldWish } from "@/features/asana/custom-fields";
import { notifyNewClientRequest } from "@/features/bot/notify";
import { classifyScope } from "@/features/bot/scope";
import { consumeRequest } from "@/features/retainers/periods";
import { logActivity } from "@/lib/activity";
import { requestsStructuredGenerator } from "@/lib/ai/structured";
import { domainOf, externalRecipients, withAlwaysCc } from "./addresses";
import {
  aiFieldWishes,
  buildReplyStoryHtml,
  buildTaskHtmlNotes,
} from "./asana-content";
import { formatSpanishDate } from "./dates";
import {
  completeExtraction,
  extractEmailRequest,
  type EmailExtraction,
  type RequestChannel,
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
import { classifyReply, type ReplyClassification } from "./reply-classify";
import {
  priorityStyle,
  renderAdjustmentsAckEmail,
  renderApprovedEmail,
  renderCommentAckEmail,
  renderConfirmationEmail,
  stageFromEstado,
  type FieldChange,
  type RenderedEmail,
} from "./templates";

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
  /** Respuesta del cliente: clasificación (persistida para reanudar). */
  reply?: ReplyClassification | null;
  /** Acuse de la respuesta reclamado (antes de enviar) y enviado. */
  ackClaimed?: boolean;
  ackSent?: boolean;
  /** Cambios de Asana por la respuesta ya aplicados. */
  replyApplied?: boolean;
};

export const STUDIO_SENDER_NAME = "Studio Nomade";

// Opciones de "Estado" en Asana (se usan solo si existen en el proyecto).
export const ESTADO_FIELD = "Estado";
export const ESTADO_SENT = ["Enviado a cliente"];
export const ESTADO_ADJUSTMENTS = ["Con ajustes"];
export const ESTADO_APPROVED = ["Aprobado"];
export const ESTADO_REVIEW = ["Por revisar"];
export const ESTADO_OUT_OF_SCOPE = "Fuera de alcance";
const PRIORITY_FIELD = "Prioridad";
const TICKET_FIELD = "¿Ticket Activo?";

/** Opciones de Prioridad en Asana, en orden de preferencia. */
export function priorityOptions(priority: EmailExtraction["priority"]) {
  switch (priority) {
    case "urgente":
      return ["Urgente", "Alta"];
    case "alta":
      return ["Alta"];
    case "media":
      return ["Media"];
    default:
      return ["Normal", "Baja"];
  }
}

/**
 * Sinónimos de cada canal en las opciones de Asana: sirven para "Formato /
 * Canal" (agencias) y para "Formato" (PNG, Video, Diseño Email, Web,
 * Paper/Word…). Las opciones que no existen en el proyecto se ignoran.
 */
const CHANNEL_OPTIONS: Record<RequestChannel, string[]> = {
  Instagram: ["Instagram", "PNG"],
  Facebook: ["Facebook", "PNG"],
  LinkedIn: ["LinkedIn", "PNG"],
  TikTok: ["TikTok", "Video"],
  YouTube: ["YouTube", "Video"],
  Email: ["Email", "Mailing", "Diseño Email"],
  Web: ["Web"],
  "PDF - Documento": [
    "PDF - Documento",
    "PDF / documento",
    "PDF",
    "Paper/Word",
  ],
  Impreso: ["Impreso"],
  Otro: ["Otro"],
};

/**
 * Campos de la tarea nueva por nombre: Prioridad, Ingreso Solicitud, Canal
 * (multi), Cliente final (en proyectos de agencias el campo local "Cliente" guarda el
 * cliente final), Folio NOMA, Correo de contacto, Estado (Por revisar) y
 * ¿Ticket Activo? (Si). Lo que no exista en el proyecto se omite.
 */
export function taskFieldWishes(
  extraction: EmailExtraction,
  folio: string,
  requesterEmail?: string | null,
  aiFields: readonly string[] = [],
): CustomFieldWish[] {
  const channelOptions = extraction.channels.flatMap(
    (channel) => CHANNEL_OPTIONS[channel] ?? [],
  );
  return [
    // Primero lo que eligió la IA con la pauta del cliente (gana sobre el canal).
    ...aiFieldWishes(extraction.field_choices, aiFields),
    {
      kind: "enum",
      fields: [PRIORITY_FIELD],
      options: priorityOptions(extraction.priority),
    },
    { kind: "enum", fields: ["Ingreso Solicitud"], options: ["Correo"] },
    ...(channelOptions.length
      ? [
          {
            kind: "multi_enum" as const,
            fields: ["Formato / Canal", "Canal", "Formato"],
            options: channelOptions,
          },
        ]
      : []),
    ...(extraction.end_client
      ? [
          {
            kind: "enum" as const,
            fields: ["Cliente final", "Cliente"],
            options: [extraction.end_client],
          },
        ]
      : []),
    { kind: "text", fields: ["Folio NOMA", "Folio"], value: folio },
    ...(requesterEmail
      ? [
          {
            kind: "text" as const,
            fields: ["Correo de contacto", "Contacto"],
            value: requesterEmail,
          },
        ]
      : []),
    // Estado inicial del tablero y ticket abierto (columnas del proyecto).
    { kind: "enum", fields: [ESTADO_FIELD], options: ESTADO_REVIEW },
    { kind: "enum", fields: [TICKET_FIELD], options: ["Si", "Sí"] },
  ];
}

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
  return requestsStructuredGenerator();
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
  /**
   * La IA determinó que el correo no pide trabajo (felicitación, comentario,
   * respuesta a un comunicado…): no se crea solicitud, tarea ni confirmación.
   */
  notRequest?: string;
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
  const visibleCc = aliasVisible
    ? externalRecipients(visible, [...ownAddresses, requester.email])
    : [];
  const cc = withAlwaysCc(visibleCc, channel.alwaysCc ?? [], [
    ...ownAddresses,
    requester.email,
  ]).slice(0, MAX_REPLY_CC);
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
        briefGuide: channel.briefGuide,
      },
      structuredGenerator(),
    );
    progress.extraction = result.extraction;
    progress.extractionSource = result.source;
    if (result.error) {
      warnings.push(`IA: ${result.error}`);
      // Visible en los logs: la extracción cayó a la heurística sin IA.
      console.warn("[email:extract] heurística sin IA:", result.error);
    }
    await patchEventPayload(input.eventId, progress);
  }
  const extraction = completeExtraction(progress.extraction);

  // 1b) ¿Es una solicitud? Solo se descarta con lectura de IA y si aún no
  // existe la solicitud (un reintento de un evento ya creado sigue su curso).
  if (
    !extraction.is_request &&
    progress.extractionSource === "llm" &&
    !(await db.query.clientRequests.findFirst({
      where: eq(clientRequests.sourceMessageId, sourceKey),
      columns: { id: true },
    }))
  ) {
    return {
      requestId: "",
      folio: "",
      created: false,
      warnings,
      needsReview: false,
      notRequest: extraction.not_request_reason ?? "Sin pedido concreto",
    };
  }

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
      warnings.push(
        "Alias no visible (copia oculta o correo redirigido): se responde al remitente y a las copias fijas.",
      );
    }
    const outcome = await db
      .transaction(async (tx) => {
        const folio = await nextFolio(tx, channel.folioPrefix, email.date);
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
        extraction,
        email,
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
      slackWebhookEnv: channel.slackWebhookEnv,
      clientName: channel.clientName,
      projectName: channel.projectName,
      summary: extraction.title,
      scopeClass: request.scopeClass,
      asanaUrl: request.asanaUrl,
      folio: request.folio,
      endClient: extraction.end_client,
      channels: extraction.channels.length
        ? extraction.channels.join(", ")
        : null,
      priority: priorityStyle(extraction.priority).label,
      dueDate: extraction.requested_due_date
        ? formatSpanishDate(extraction.requested_due_date)
        : null,
      requester: request.requesterName
        ? `${request.requesterName} (${from.email})`
        : from.email,
      assigned: Boolean(channel.defaultAssigneeGid),
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
  const customFields = await resolveCustomFieldValues(
    channel.asanaProjectGid,
    taskFieldWishes(
      extraction,
      request.folio ?? "",
      request.requesterEmail ?? email.from?.email ?? null,
      channel.aiFields,
    ),
  ).catch(() => ({}));

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
    extraction: EmailExtraction;
    email: ParsedEmail;
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
    clientName: ctx.channel.clientName,
    alias: ctx.channel.alias,
    title: ctx.extraction.title,
    requesterName: request.requesterName,
    requesterEmail: request.requesterEmail ?? ctx.email.from?.email ?? "",
    extraction: ctx.extraction,
    receivedAt: ctx.email.date,
    attachmentNames: selectAttachments(ctx.email.attachments).selected.map(
      (ref) => ref.filename,
    ),
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
      subject: replySubject(request.emailSubject),
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

  // El mensaje del cliente pasa a ser el último del hilo (los acuses de Noma
  // responden a él).
  const [current] = await db
    .update(clientRequests)
    .set({
      emailLastMessageId: email.messageId ?? request.emailLastMessageId,
      updatedAt: new Date(),
    })
    .where(eq(clientRequests.id, request.id))
    .returning();

  // Respuestas internas del estudio en el hilo solo comentan.
  const isInternal = domainOf(from.email) === studioDomain();
  if (!isInternal) {
    const outcome = await actOnClientReply({
      eventId: input.eventId,
      progress,
      email,
      request: current ?? request,
      channel: input.channel,
      taskGid,
      replyText: replyBody(email).text,
    });
    notes.push(...outcome.notes);
    if (outcome.needsReview) {
      return { status: "review", note: notes.join(" · ") || null };
    }
  }

  await logActivity({
    entityType: "client_request",
    entityId: request.id,
    action: "email_reply_commented",
  });
  return { status: "done", note: notes.join(" · ") || null };
}

// ─────────────────────────────────────────────────────────────
// Acuse de la respuesta del cliente (02 · 05 · 06) y cambios en Asana
// ─────────────────────────────────────────────────────────────
type LastDelivery = {
  round: number;
  files: { label: string; url: string; detail: string | null }[];
  links: string[];
  sentAt: Date | null;
};

async function lastSentDelivery(
  requestId: string,
): Promise<LastDelivery | null> {
  const rows = await db
    .select({
      round: requestDeliveries.round,
      files: requestDeliveries.files,
      links: requestDeliveries.links,
      sentAt: requestDeliveries.sentAt,
    })
    .from(requestDeliveries)
    .where(
      and(
        eq(requestDeliveries.clientRequestId, requestId),
        eq(requestDeliveries.kind, "delivery"),
        eq(requestDeliveries.status, "sent"),
      ),
    )
    .orderBy(desc(requestDeliveries.round))
    .limit(1);
  return rows[0] ?? null;
}

async function lastConsultaQuestions(requestId: string): Promise<string[]> {
  const rows = await db
    .select({ note: requestDeliveries.note })
    .from(requestDeliveries)
    .where(
      and(
        eq(requestDeliveries.clientRequestId, requestId),
        eq(requestDeliveries.kind, "consulta"),
        eq(requestDeliveries.status, "sent"),
      ),
    )
    .orderBy(desc(requestDeliveries.createdAt))
    .limit(1);
  return (rows[0]?.note ?? "").split("\n").filter(Boolean);
}

async function countSentDeliveries(requestId: string) {
  const rows = await db
    .select({ round: requestDeliveries.round })
    .from(requestDeliveries)
    .where(
      and(
        eq(requestDeliveries.clientRequestId, requestId),
        eq(requestDeliveries.kind, "delivery"),
        eq(requestDeliveries.status, "sent"),
      ),
    );
  return new Set(rows.map((row) => row.round)).size;
}

/** Envía un correo de Noma en el hilo de la solicitud y guarda el Message-ID. */
export async function sendThreadEmail(
  request: EmailRequestRow,
  channel: ResolvedEmailChannel,
  rendered: RenderedEmail,
) {
  const thread = buildReplyThreadHeaders({
    parentMessageId: request.emailLastMessageId ?? request.emailMessageId,
    references: [request.emailMessageId],
  });
  const sent = await sendReply({
    threadId: request.emailThreadId!,
    from: { name: STUDIO_SENDER_NAME, email: channel.alias },
    to: [request.requesterEmail!],
    cc: request.ccEmails ?? [],
    subject: replySubject(request.emailSubject),
    html: rendered.html,
    text: rendered.text,
    inReplyTo: thread.inReplyTo,
    references: thread.references,
  });
  await db
    .update(clientRequests)
    .set({
      emailLastMessageId: sent.messageId ?? request.emailLastMessageId,
      updatedAt: new Date(),
    })
    .where(eq(clientRequests.id, request.id));
  return sent;
}

export function requestTitle(request: EmailRequestRow) {
  return (
    request.normalizedSummary?.split(" — ")[0] ?? request.emailSubject ?? ""
  );
}

async function actOnClientReply(input: {
  eventId: string;
  progress: EventProgress;
  email: ParsedEmail;
  request: EmailRequestRow;
  channel: ResolvedEmailChannel | null;
  taskGid: string;
  replyText: string;
}): Promise<{ notes: string[]; needsReview: boolean }> {
  const { email, request, progress, taskGid } = input;
  const notes: string[] = [];
  const channel = input.channel;
  const task = await getTaskState(taskGid);
  const projectGid =
    channel?.asanaProjectGid ?? task.projects?.[0]?.gid ?? null;
  const delivery = await lastSentDelivery(request.id);

  // 1) Clasificación (persistida: un reintento no vuelve a llamar a la IA).
  if (progress.reply === undefined) {
    const result = await classifyReply(
      {
        folio: request.folio ?? "",
        title: requestTitle(request),
        lastDeliveryRound: delivery?.round ?? null,
        openQuestions: await lastConsultaQuestions(request.id),
        fromName: email.from?.name ?? null,
        date: email.date,
        body: input.replyText,
      },
      structuredGenerator(),
    );
    progress.reply = result.classification;
    if (result.error) notes.push(`IA: ${result.error}`);
    await patchEventPayload(input.eventId, progress);
  }
  const reply = progress.reply;

  // Sin IA: comportamiento previo (reabre una tarea cerrada, sin acuse).
  if (!reply) {
    if (task.completed) {
      await setTaskCompleted(taskGid, false);
      if (projectGid) {
        await setEnumFieldByName(
          taskGid,
          projectGid,
          ESTADO_FIELD,
          ESTADO_ADJUSTMENTS,
        ).catch(() => false);
      }
      notes.push("Tarea reabierta por respuesta del cliente.");
    }
    return { notes, needsReview: false };
  }
  notes.push(`Respuesta clasificada: ${reply.kind}`);
  if (reply.kind === "empty") return { notes, needsReview: false };

  // 2) Cambios en Asana (una sola vez por evento; degradables).
  const changes: FieldChange[] = [];
  if (!progress.replyApplied && projectGid) {
    const estado = (options: string[]) =>
      setEnumFieldByName(taskGid, projectGid, ESTADO_FIELD, options).catch(
        (error) => {
          notes.push(
            `Estado no actualizado: ${error instanceof Error ? error.message : "error"}`,
          );
          return false;
        },
      );
    try {
      if (reply.kind === "approval") {
        await estado(ESTADO_APPROVED);
        await setEnumFieldByName(taskGid, projectGid, TICKET_FIELD, [
          "Finalizado",
        ]).catch(() => false);
        if (!task.completed) await setTaskCompleted(taskGid, true);
        notes.push("Aprobada por el cliente: tarea completada.");
      } else {
        if (task.completed) {
          await setTaskCompleted(taskGid, false);
          notes.push("Tarea reabierta por respuesta del cliente.");
        }
        if (reply.kind === "adjustments") {
          await estado(ESTADO_ADJUSTMENTS);
          await db
            .update(clientRequests)
            .set({
              emailPendingAdjustments: reply.adjustments,
              updatedAt: new Date(),
            })
            .where(eq(clientRequests.id, request.id));
        } else if (reply.kind === "ambiguous") {
          await estado(ESTADO_REVIEW);
          notes.push("Respuesta ambigua: la tarea vuelve a Por revisar.");
        } else if (task.completed) {
          await estado(ESTADO_ADJUSTMENTS);
        }
      }
      if (reply.new_due_date && reply.new_due_date !== task.due_on) {
        await setTaskDueOn(taskGid, reply.new_due_date);
        changes.push({
          field: "Fecha ideal de entrega",
          before: task.due_on
            ? formatSpanishDate(task.due_on)
            : "Por confirmar",
          after: formatSpanishDate(reply.new_due_date),
        });
      }
      if (reply.new_priority) {
        const before = taskFieldValue(task, PRIORITY_FIELD);
        const values = await resolveCustomFieldValues(projectGid, [
          {
            kind: "enum",
            fields: [PRIORITY_FIELD],
            options: priorityOptions(reply.new_priority),
          },
        ]);
        const after = priorityStyle(reply.new_priority).label;
        if (Object.keys(values).length && before !== after) {
          await setTaskCustomFields(taskGid, values);
          changes.push({ field: "Prioridad", before, after });
        }
      }
      if (reply.new_format) {
        changes.push({
          field: "Formato",
          before: null,
          after: reply.new_format,
        });
      }
    } catch (error) {
      notes.push(`Asana: ${error instanceof Error ? error.message : "error"}`);
    }
    progress.replyApplied = true;
    await patchEventPayload(input.eventId, progress);
  }

  // 3) Acuse en el hilo (reclamado antes de enviar para no duplicar).
  if (!channel || !request.emailThreadId || !request.requesterEmail) {
    notes.push("Sin canal o hilo: no se envió acuse.");
    return { notes, needsReview: false };
  }
  if (progress.ackSent) return { notes, needsReview: false };
  if (progress.ackClaimed) {
    notes.push("Acuse reclamado sin respuesta de Gmail; revisar si llegó.");
    return { notes, needsReview: true };
  }
  const common = {
    folio: request.folio ?? "",
    clientName: channel.clientName,
    alias: channel.alias,
    title: requestTitle(request),
    requesterName: request.requesterName,
  };
  let rendered: RenderedEmail;
  if (reply.kind === "approval" && delivery) {
    rendered = renderApprovedEmail({
      ...common,
      finalRound: delivery.round,
      totalRounds: Math.max(1, await countSentDeliveries(request.id)),
      receivedAt: request.createdAt,
      approvedAt: email.date,
      files: delivery.files.length
        ? delivery.files
        : delivery.links.map((url, index) => ({
            label: `Archivo ${String(index + 1).padStart(2, "0")}`,
            url,
            detail: null,
          })),
    });
  } else if (reply.kind === "adjustments" && delivery) {
    rendered = renderAdjustmentsAckEmail({
      ...common,
      reviewedRound: delivery.round,
      adjustments: reply.adjustments,
      doubts: reply.doubts,
    });
  } else {
    const estado = taskFieldValue(task, ESTADO_FIELD);
    const uploaded = selectAttachments(email.attachments).selected;
    rendered = renderCommentAckEmail({
      ...common,
      receivedAt: email.date,
      stage: reply.kind === "ambiguous" ? 1 : (stageFromEstado(estado) ?? 1),
      isQuestion: reply.kind === "question" || reply.kind === "ambiguous",
      points: reply.points,
      changes,
      files: uploaded.map((ref) => ({ name: ref.filename, type: "Adjunto" })),
      pending: reply.doubts,
    });
  }
  progress.ackClaimed = true;
  await patchEventPayload(input.eventId, progress);
  try {
    await sendThreadEmail(request, channel, rendered);
    progress.ackSent = true;
    await patchEventPayload(input.eventId, progress);
  } catch (error) {
    if (isDefinite(error)) {
      // Gmail rechazó: no salió. Se libera para reintentar el evento.
      progress.ackClaimed = false;
      await patchEventPayload(input.eventId, progress);
      throw error;
    }
    notes.push(
      `Acuse sin confirmar (${error instanceof Error ? error.message : "corte"}); revisar si llegó.`,
    );
    return { notes, needsReview: true };
  }
  return { notes, needsReview: false };
}
