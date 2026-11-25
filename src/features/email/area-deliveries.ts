import "server-only";

import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  type AreaMailboxThread,
  areaEmailProjects,
  areaEmailSends,
  areaEmailThreads,
} from "@/db/schema";
import {
  type AsanaAttachment,
  type AsanaStory,
  addStory,
  downloadAsanaAttachment,
  getStory,
  getTaskAssignee,
  getTaskForThread,
  listTaskAttachments,
  resolveBotUserGid,
} from "@/features/asana/asana";
import { foldName } from "@/features/asana/custom-fields";
import { normalizeEmail } from "./addresses";
import {
  areaClientAndRequest,
  areaDeliverySubject,
  areaReplySubject,
  areaSubjectBase,
  normalizeThreadSubject,
} from "./area-subject";
import {
  MAX_ATTACHMENTS_BYTES,
  formatBytes,
  matchAttachments,
  mimeTypeFor,
} from "./attachments";
import {
  businessHoursFromEnv,
  deferredSendAt,
  formatBusinessSlot,
  wantsImmediateSend,
} from "./business-hours";
import { storyCommand } from "./deliveries";
import { deliveryCc } from "./delivery-team";
import {
  type RenderedEmail,
  escapeHtml,
  renderCommentEmail,
  renderConsultaEmail,
  renderDeliveryEmail,
} from "./email-templates/render";
import { GmailApiError, requestsMailbox, sendReply } from "./inbox";
import {
  type OutgoingAttachment,
  buildMimeMessage,
  generateMessageId,
} from "./mime";
import { studioDomain } from "./requests";
import { CONTACT_FIELD } from "./thread-open-rules";
import {
  UserMailboxError,
  emailForAsanaUser,
  sendAsStudioUser,
  studioSenderFor,
} from "./user-mailbox";

/**
 * Modelo B · proyectos generales de área (Clínica de Emprendimientos, Web
 * Design…). ENTREGA, CONSULTA y COMENTARIO salen desde la cuenta de Google de
 * quien comenta, con el asunto del área («CE - Cliente | Solicitud - Entrega
 * 02»). Si la persona no tiene Google conectado en Noma (o Gmail lo rechaza),
 * sale desde operations@ con copia a ella y Noma lo deja dicho en la tarea.
 */

export type AreaOutcome =
  | "sent"
  | "scheduled"
  | "rejected"
  | "skipped_not_command"
  | "skipped_bot"
  | "skipped_duplicate";

const CLIENT_FIELD = "Cliente";

export type AreaProject = typeof areaEmailProjects.$inferSelect;

/** Proyecto de área con correo activo (null: no es modelo B). */
export async function areaProjectConfig(
  projectGid: string | null | undefined,
): Promise<AreaProject | null> {
  if (!projectGid) return null;
  const [row] = await db
    .select()
    .from(areaEmailProjects)
    .where(
      and(
        eq(areaEmailProjects.asanaProjectGid, projectGid),
        eq(areaEmailProjects.status, "active"),
      ),
    )
    .limit(1);
  return row ?? null;
}

type TaskForThread = Awaited<ReturnType<typeof getTaskForThread>>;

function fieldText(task: TaskForThread | null, name: string) {
  const field = task?.custom_fields?.find(
    (item) => foldName(item.name ?? "") === foldName(name),
  );
  return field?.display_value?.trim() || null;
}


function validEmail(value: string | null) {
  const email = value ? normalizeEmail(value) : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function processAreaStory(
  storyGid: string,
  options: {
    project: AreaProject;
    story?: AsanaStory;
    botUserGid?: string;
    /** Envío programado fuera de horario que ya venció. */
    dueRun?: boolean;
  },
): Promise<AreaOutcome> {
  const { project } = options;
  const story = options.story ?? (await getStory(storyGid));
  if (story.resource_subtype !== "comment_added") return "skipped_not_command";
  const botUserGid = options.botUserGid ?? (await resolveBotUserGid());
  if (!story.created_by || story.created_by.gid === botUserGid) {
    return "skipped_bot";
  }
  const command = storyCommand(story);
  if (
    !command ||
    (command.kind !== "delivery" &&
      command.kind !== "consulta" &&
      command.kind !== "comentario")
  ) {
    return "skipped_not_command";
  }
  const commentedTaskGid = story.target?.gid;
  if (!commentedTaskGid) return "skipped_not_command";

  // Las subtareas entregan en el hilo de su tarea principal.
  const commented = await getTaskForThread(commentedTaskGid);
  const rootGid = commented?.parent?.gid ?? commentedTaskGid;
  const root =
    rootGid === commentedTaskGid ? commented : await getTaskForThread(rootGid);

  const round = command.kind === "delivery" ? command.delivery.round : 0;
  const [inserted] = await db
    .insert(areaEmailSends)
    .values({
      asanaStoryGid: story.gid,
      asanaTaskGid: rootGid,
      asanaProjectGid: project.asanaProjectGid,
      kind: command.kind,
      round,
      status: "sending",
    })
    .onConflictDoNothing({ target: areaEmailSends.asanaStoryGid })
    .returning();
  let send = inserted;
  if (!send) {
    const [retry] = await db
      .update(areaEmailSends)
      .set({ status: "sending", error: null, updatedAt: new Date() })
      .where(
        and(
          eq(areaEmailSends.asanaStoryGid, story.gid),
          options.dueRun
            ? inArray(areaEmailSends.status, ["failed", "scheduled"])
            : eq(areaEmailSends.status, "failed"),
        ),
      )
      .returning();
    if (!retry) return "skipped_duplicate";
    send = retry;
  }

  const padded = String(round).padStart(2, "0");
  const what =
    command.kind === "delivery"
      ? `la Entrega ${padded}`
      : command.kind === "comentario"
        ? "el comentario"
        : "la consulta";
  const reject = async (error: string, comment: string) => {
    await db
      .update(areaEmailSends)
      .set({ status: "rejected", error, updatedAt: new Date() })
      .where(eq(areaEmailSends.id, send.id));
    await addStory(commentedTaskGid, `<body><em>${comment}</em></body>`).catch(
      (err) => console.error("[area-email:reject]", err),
    );
    return "rejected" as const;
  };

  const contact =
    validEmail(fieldText(commented, CONTACT_FIELD)) ??
    validEmail(fieldText(root, CONTACT_FIELD));
  if (!contact) {
    return reject(
      "Sin «Correo de contacto».",
      `Noma no envió ${what}: la tarea no tiene «${CONTACT_FIELD}». Complétalo con el correo del cliente y vuelve a comentar.`,
    );
  }

  // Horario hábil: fuera de él sale a las 08:55 del siguiente día hábil.
  if (!options.dueRun && !wantsImmediateSend(story.text)) {
    const commentedAt = story.created_at
      ? new Date(story.created_at)
      : new Date();
    const sendAt = deferredSendAt(commentedAt, businessHoursFromEnv());
    if (sendAt && sendAt.getTime() > Date.now()) {
      await db
        .update(areaEmailSends)
        .set({ status: "scheduled", updatedAt: new Date() })
        .where(eq(areaEmailSends.id, send.id));
      await addStory(
        commentedTaskGid,
        `<body><em>Fuera del horario hábil (lunes a viernes, 9:00 a 18:00): Noma enviará ${what} al cliente ${escapeHtml(formatBusinessSlot(sendAt))}. Para enviarla de inmediato, escribe «ENVIAR AHORA» en el comentario.</em></body>`,
      ).catch((error) => console.error("[area-email:scheduled]", error));
      return "scheduled";
    }
  }

  // Adjuntos («Adjunto: nombre»), subidos a la tarea comentada.
  const requested =
    command.kind === "delivery"
      ? command.delivery.attachments
      : command.kind === "comentario"
        ? command.comment.attachments
        : [];
  let plan: AsanaAttachment[] = [];
  if (requested.length) {
    const available = await listTaskAttachments(commentedTaskGid);
    const { matched, missing } = matchAttachments(
      requested,
      available.map((item) => ({
        gid: item.gid,
        name: item.name,
        size: item.size ?? null,
        downloadable:
          Boolean(item.download_url) && (item.host ?? "asana") === "asana",
        createdAt: item.created_at ?? null,
      })),
    );
    if (missing.length) {
      return reject(
        `Adjunto no encontrado: ${missing.join(", ")}.`,
        `Noma no envió ${what}: no encontró ${missing.map((name) => `«${escapeHtml(name)}»`).join(", ")} entre los archivos adjuntos a esta tarea. Adjunta el archivo y comenta de nuevo con «Adjunto: nombre del archivo».`,
      );
    }
    if (matched.some((item) => !item.downloadable)) {
      return reject(
        "Adjunto enlazado desde otro servicio.",
        `Noma no envió ${what}: hay un adjunto enlazado desde Drive u otro servicio. Súbelo como archivo a la tarea o compártelo como link («Nombre: link»).`,
      );
    }
    const total = matched.reduce((sum, item) => sum + (item.size ?? 0), 0);
    if (total > MAX_ATTACHMENTS_BYTES) {
      return reject(
        "Adjuntos sobre el tope.",
        `Noma no envió ${what}: los adjuntos pesan ${escapeHtml(formatBytes(total))} y el tope por correo es ${escapeHtml(formatBytes(MAX_ATTACHMENTS_BYTES))}. Compártelos como link.`,
      );
    }
    plan = matched.map((item) =>
      available.find((candidate) => candidate.gid === item.gid)!,
    );
  }
  const attachmentInfo = plan.map((item) => ({
    name: item.name,
    sizeLabel: formatBytes(item.size) || null,
  }));

  // Identificador del área: «CE - Cliente | Solicitud».
  const { client, request } = areaClientAndRequest(
    root?.name ?? commented?.name ?? "",
    fieldText(root, CLIENT_FIELD),
  );
  const subjectBase = areaSubjectBase(project.areaCode, client, request);
  const [threadRow] = await db
    .insert(areaEmailThreads)
    .values({
      asanaTaskGid: rootGid,
      asanaProjectGid: project.asanaProjectGid,
      subjectBase,
      contactEmail: contact,
    })
    .onConflictDoUpdate({
      target: areaEmailThreads.asanaTaskGid,
      set: { subjectBase, contactEmail: contact, updatedAt: new Date() },
    })
    .returning();
  const threads: AreaMailboxThread[] = threadRow?.threads ?? [];

  // Quién envía: la cuenta de Google de quien comenta, si está conectada.
  const commenterEmail = await emailForAsanaUser(story.created_by.gid);
  const commenterName = story.created_by.name?.trim() || null;
  const sender = await studioSenderFor(commenterEmail);
  const operations = requestsMailbox();

  // Asunto e hilo: cada entrega abre su asunto «- Entrega NN»; consultas y
  // comentarios van en el último hilo de la tarea (o con el asunto base).
  const latest = threads.at(-1) ?? null;
  const subject =
    command.kind === "delivery"
      ? areaDeliverySubject(subjectBase, round)
      : latest
        ? areaReplySubject(latest.subject)
        : subjectBase;
  const sameSubject = threads.filter(
    (item) =>
      normalizeThreadSubject(item.subject) === normalizeThreadSubject(subject),
  );
  const previous = sameSubject.at(-1) ?? null;

  const assignee = await getTaskAssignee(rootGid).catch(() => null);
  const assigneeEmail =
    assignee?.email ??
    (assignee?.gid ? await emailForAsanaUser(assignee.gid) : null);

  const common = {
    folio: client ? `${project.areaCode} · ${client}` : project.areaCode,
    clientName: client ?? project.areaLabel,
    title: request,
    requesterName: null,
    signatureName: commenterName,
    threadNote:
      "Responde este correo para todo lo relacionado con esta solicitud: así queda registrado en nuestro equipo.",
  };

  if (command.kind === "delivery") {
    if (!command.delivery.links.length && !plan.length) {
      return reject(
        "El comentario no trae links.",
        `Noma no envió la Entrega ${padded}: el comentario no trae links ni adjuntos. Comenta «ENTREGA ${padded}» con un archivo por línea («Nombre: link») o «Adjunto: nombre del archivo».`,
      );
    }
  } else if (command.kind === "consulta") {
    if (!command.consulta.questions.length) {
      return reject(
        "La consulta no trae preguntas.",
        "Noma no envió la consulta: escribe «CONSULTA» y debajo una pregunta por línea.",
      );
    }
  } else if (
    !command.comment.text &&
    !command.comment.files.length &&
    !plan.length
  ) {
    return reject(
      "El comentario no trae texto.",
      "Noma no envió el comentario: escribe «Comentario» y debajo el texto para el cliente.",
    );
  }

  const renderFor = (fromEmail: string): RenderedEmail => {
    const withSender = {
      ...common,
      alias: fromEmail,
      footer: `Studio Nomade · ${project.areaLabel} · ${fromEmail}`,
    };
    if (command.kind === "delivery") {
      return renderDeliveryEmail({
        ...withSender,
        round,
        files: command.delivery.files,
        attachments: attachmentInfo,
        note: command.delivery.note,
        author: null,
        pieceLabel: request,
      });
    }
    if (command.kind === "consulta") {
      return renderConsultaEmail({
        ...withSender,
        stage: null,
        questions: command.consulta.questions,
        blocking: command.consulta.blocking,
        author: null,
      });
    }
    return renderCommentEmail({
      ...withSender,
      text: command.comment.text,
      files: command.comment.files,
      attachments: attachmentInfo,
      author: null,
    });
  };

  const attachments: OutgoingAttachment[] = [];
  if (plan.length) {
    try {
      const fresh = await listTaskAttachments(commentedTaskGid);
      for (const item of plan) {
        const url =
          fresh.find((candidate) => candidate.gid === item.gid)?.download_url ??
          item.download_url;
        if (!url) throw new Error(`El adjunto «${item.name}» ya no está.`);
        attachments.push({
          filename: item.name,
          mimeType: mimeTypeFor(item.name),
          content: await downloadAsanaAttachment(url),
        });
      }
    } catch (error) {
      await db
        .update(areaEmailSends)
        .set({
          status: "failed",
          error:
            error instanceof Error ? error.message.slice(0, 500) : "Adjunto",
          updatedAt: new Date(),
        })
        .where(eq(areaEmailSends.id, send.id));
      throw error;
    }
  }

  const threadHeaders = (mailbox: string) => {
    const parent = previous?.lastMessageId ?? null;
    const references = previous
      ? [...previous.references, previous.lastMessageId].slice(-20)
      : [];
    return {
      inReplyTo: parent,
      references,
      threadId:
        previous && previous.mailbox === mailbox ? previous.threadId : null,
    };
  };

  type Sent = {
    via: "personal" | "operations";
    fromEmail: string;
    cc: string[];
    gmailId: string;
    threadId: string | null;
    messageId: string;
    fallbackReason: string | null;
  };

  const sendPersonal = async (from: {
    userId: string;
    email: string;
  }): Promise<Sent> => {
    const cc = deliveryCc({
      requestCc: [],
      commenterEmail,
      assigneeEmail,
      studioDomain: studioDomain(),
      exclude: [contact, from.email],
    });
    const headers = threadHeaders(from.email);
    const messageId = generateMessageId(
      from.email.split("@")[1] ?? "studionomade.cl",
    );
    const out = renderFor(from.email);
    const raw = buildMimeMessage({
      from: { name: commenterName ?? from.email, email: from.email },
      to: [contact],
      cc,
      subject,
      html: out.html,
      text: out.text,
      inReplyTo: headers.inReplyTo,
      references: headers.references,
      messageId,
      attachments,
    });
    const result = await sendAsStudioUser({
      userId: from.userId,
      raw,
      threadId: headers.threadId,
      large: attachments.length > 0,
    });
    return {
      via: "personal",
      fromEmail: from.email,
      cc,
      gmailId: result.id,
      threadId: result.threadId,
      messageId,
      fallbackReason: null,
    };
  };

  const sendOperations = async (reason: string): Promise<Sent> => {
    if (!operations) throw new Error("Falta NOMA_REQUESTS_MAILBOX.");
    const cc = deliveryCc({
      requestCc: [],
      commenterEmail,
      assigneeEmail,
      studioDomain: studioDomain(),
      exclude: [contact, operations],
    });
    const headers = threadHeaders(operations);
    const out = renderFor(operations);
    const result = await sendReply({
      threadId: headers.threadId,
      from: {
        name: commenterName
          ? `${commenterName} · Studio Nomade`
          : "Studio Nomade",
        email: operations,
      },
      to: [contact],
      cc,
      subject,
      html: out.html,
      text: out.text,
      inReplyTo: headers.inReplyTo,
      references: headers.references,
      attachments,
    });
    return {
      via: "operations",
      fromEmail: operations,
      cc,
      gmailId: result.id,
      threadId: result.threadId,
      messageId: result.messageId ?? "",
      fallbackReason: reason,
    };
  };

  let sent: Sent;
  try {
    if (sender) {
      try {
        sent = await sendPersonal(sender);
      } catch (error) {
        // Solo un 4xx (o un token inválido) garantiza que no salió: ahí se
        // usa el respaldo. Un corte de red o un 5xx queda para revisión.
        const definite =
          (error instanceof UserMailboxError &&
            error.status !== null &&
            error.status >= 400 &&
            error.status < 500) ||
          (error instanceof Error && error.name === "GoogleAuthError");
        if (!definite) throw error;
        sent = await sendOperations(
          "Gmail rechazó el envío desde tu cuenta (vuelve a conectar Google en Noma)",
        );
      }
    } else {
      sent = await sendOperations(
        "tu cuenta de Google no está conectada en Noma (Mis conexiones)",
      );
    }
  } catch (error) {
    const definite =
      (error instanceof GmailApiError &&
        error.status !== null &&
        error.status >= 400 &&
        error.status < 500) ||
      (error instanceof Error && error.message.startsWith("Falta"));
    await db
      .update(areaEmailSends)
      .set({
        status: definite ? "failed" : "unknown",
        error: error instanceof Error ? error.message.slice(0, 500) : "Error",
        updatedAt: new Date(),
      })
      .where(eq(areaEmailSends.id, send.id));
    throw error;
  }

  const now = new Date();
  const entry: AreaMailboxThread = {
    mailbox: sent.fromEmail,
    threadId: sent.threadId,
    subject,
    lastMessageId: sent.messageId,
    references: previous
      ? [...previous.references, previous.lastMessageId].slice(-20)
      : [],
  };
  const nextThreads = [
    ...threads.filter(
      (item) =>
        !(
          item.mailbox === entry.mailbox &&
          normalizeThreadSubject(item.subject) ===
            normalizeThreadSubject(entry.subject)
        ),
    ),
    entry,
  ].slice(-30);
  await db
    .update(areaEmailThreads)
    .set({
      threads: nextThreads,
      ...(command.kind === "delivery"
        ? { lastRound: Math.max(round, threadRow?.lastRound ?? 0) }
        : {}),
      updatedAt: now,
    })
    .where(eq(areaEmailThreads.asanaTaskGid, rootGid));
  await db
    .update(areaEmailSends)
    .set({
      status: "sent",
      via: sent.via,
      fromEmail: sent.fromEmail,
      toEmails: [contact],
      ccEmails: sent.cc,
      subject,
      gmailMessageId: sent.gmailId,
      gmailThreadId: sent.threadId,
      sentAt: now,
      updatedAt: now,
    })
    .where(eq(areaEmailSends.id, send.id));

  const label =
    command.kind === "delivery"
      ? `la Entrega ${padded}`
      : command.kind === "consulta"
        ? "la consulta"
        : "el comentario";
  const fallback = sent.fallbackReason
    ? ` Salió desde ${escapeHtml(sent.fromEmail)} porque ${escapeHtml(sent.fallbackReason)}.`
    : "";
  await addStory(
    commentedTaskGid,
    `<body><em>Noma envió ${label} al cliente desde ${escapeHtml(sent.fromEmail)} · Asunto: ${escapeHtml(subject)} · Para: ${escapeHtml(contact)}${sent.cc.length ? ` · Copia: ${escapeHtml(sent.cc.join(", "))}` : ""}.${fallback}</em></body>`,
  ).catch((error) => console.error("[area-email:story]", error));
  return "sent";
}

/**
 * Envíos del modelo B programados fuera de horario cuya hora hábil llegó.
 * Lo llaman el cron de las 08:55 y, de paso, los webhooks de Asana.
 */
export async function flushScheduledAreaSends({
  limit = 10,
  deadline = Date.now() + 30_000,
}: { limit?: number; deadline?: number } = {}) {
  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1_000);
  const rows = await db
    .select({
      storyGid: areaEmailSends.asanaStoryGid,
      projectGid: areaEmailSends.asanaProjectGid,
      createdAt: areaEmailSends.createdAt,
    })
    .from(areaEmailSends)
    .where(
      and(
        eq(areaEmailSends.status, "scheduled"),
        gt(areaEmailSends.createdAt, since),
      ),
    )
    .orderBy(areaEmailSends.createdAt)
    .limit(50);
  const hours = businessHoursFromEnv();
  const due = rows
    .filter((row) => {
      const at = deferredSendAt(row.createdAt, hours);
      return !at || at.getTime() <= Date.now();
    })
    .slice(0, limit);
  let sent = 0;
  let failed = 0;
  for (const row of due) {
    if (Date.now() > deadline) break;
    try {
      const project = await areaProjectConfig(row.projectGid);
      if (!project) continue;
      const outcome = await processAreaStory(row.storyGid, {
        project,
        dueRun: true,
      });
      if (outcome === "sent") sent += 1;
    } catch (error) {
      failed += 1;
      console.error("[area-email:flush]", error);
    }
  }
  return { scheduled: rows.length, sent, failed };
}
