import "server-only";

import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  clientContacts,
  slackNotifyLog,
  studioMeetings,
  teamMembers,
  type StudioMeeting,
} from "@/db/schema";
import { studioDay } from "@/features/assistant/config";
import { operationsMailboxStatus } from "@/features/dev-tracking/meetings-queries";
import { studioSenderFor } from "@/features/email/user-mailbox";
import { createCalendarEvent } from "@/features/google/calendar";
import { requestsMailboxAccessToken } from "@/features/email/inbox";
import {
  getSlackUserEmail,
  lookupSlackUserByEmail,
  postBotMessage,
} from "@/features/slack-notify/slack-bot";
import {
  cleanSlackText,
  slackAgentEmails,
  slackAgentModel,
} from "@/features/slack-agent/config";
import { callClaudeStructured, claudeConfigured } from "@/lib/ai/claude";
import {
  cancelOpsEvent,
  createDocFromHtml,
  createDraftAsUser,
  DraftScopeError,
  ensureMeetingFolder,
  exportDocPdf,
  fileIntoFolder,
  geminiNotesFromEvent,
  readDocText,
  replaceDocHtml,
  searchGeminiNotes,
} from "./google";
import {
  minutesSlackPreview,
  renderStudioMinutes,
  STUDIO_MINUTES_PROMPT,
  studioMinutesSchema,
  type StudioMinutes,
} from "./minutes-format";
import {
  formatSlot,
  isApproval,
  isCancel,
  isProcessNow,
  meetingFolderName,
  meetingsChannel,
  meetingTitle,
  minutesRecipients,
  minutesSubject,
  normalizeArea,
  santiagoToDate,
  uniqueEmails,
  clientFolderName,
} from "./rules";

/**
 * #noma-reuniones: un hilo = una reunión.
 * 1. Mensaje nuevo → Noma propone la invitación en el hilo.
 * 2. «ok» → agenda desde operations@ (Meet; Gemini toma notas) y crea la carpeta.
 * 3. Cron → notas de Gemini a la carpeta, minuta (Doc) y aviso en el hilo.
 * 4. «aprobar» → borrador del correo con el PDF en la casilla de quien la pidió.
 */

export type MeetingsSlackEvent = {
  channel: string;
  user?: string;
  bot_id?: string;
  subtype?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
};

const GRACE_MIN = 10;
const LOOKBACK_DAYS = 5;

// ── Slack ──────────────────────────────────────────────────────

async function claim(eventId: string, channel: string) {
  const rows = await db
    .insert(slackNotifyLog)
    .values({
      eventKey: `slack-event:${eventId}`,
      slackChannelId: channel,
      kind: "meetings",
    })
    .onConflictDoNothing()
    .returning({ key: slackNotifyLog.eventKey });
  return rows.length > 0;
}

function toMrkdwn(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, "*$1*");
}

async function say(
  m: { slackChannelId: string; slackThreadTs: string },
  text: string,
) {
  await postBotMessage({
    channel: m.slackChannelId,
    threadTs: m.slackThreadTs,
    text: text.replace(/[*_`]/g, "").slice(0, 300),
    mrkdwn: toMrkdwn(text),
  });
}

// ── Propuesta (Claude) ─────────────────────────────────────────

const proposalSchema = z.object({
  area: z
    .string()
    .describe(
      "B&D, WD, A&D, A&A, CE o SN (interna). Infiérela del cliente o del tema.",
    ),
  cliente: z
    .string()
    .describe("Nombre del cliente, o «Studio Nomade» si es interna"),
  tipo: z
    .string()
    .describe("Tipo o tema corto de la reunión, p. ej. «Chao Deudas D2C»"),
  fecha: z.string().nullable().describe("YYYY-MM-DD; null si no se dijo"),
  hora: z
    .string()
    .nullable()
    .describe("HH:MM 24 h, hora de Chile; null si no se dijo"),
  duracion_min: z.number().int().describe("Por defecto 30"),
  asistentes: z
    .array(
      z.object({ nombre: z.string().nullable(), email: z.string().nullable() }),
    )
    .describe("Invitados mencionados, sin contar a quien pide"),
  agenda: z.string().nullable(),
  pregunta: z
    .string()
    .nullable()
    .describe(
      "Si falta algo imprescindible (fecha u hora), la pregunta corta; si no, null",
    ),
});
type Proposal = z.infer<typeof proposalSchema>;

function proposalOf(m: StudioMeeting): Proposal {
  const local = m.startsAt
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Santiago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .format(m.startsAt)
        .split(" ")
    : null;
  return {
    area: m.area ?? "SN",
    cliente: m.clientName ?? "Studio Nomade",
    tipo: m.meetingType ?? m.title,
    fecha: local?.[0] ?? null,
    hora: local?.[1] ?? null,
    duracion_min: m.durationMin,
    asistentes: [
      ...m.attendees.map((a) => ({ nombre: a.name ?? null, email: a.email })),
      ...m.unresolved.map((n) => ({ nombre: n, email: null })),
    ],
    agenda: m.agenda,
    pregunta: null,
  };
}

async function extractProposal(input: {
  text: string;
  current?: Proposal;
  requester: string;
}): Promise<Proposal> {
  const { data } = await callClaudeStructured<Proposal>({
    feature: "meetings_slack_request",
    model: slackAgentModel(),
    effort: "low",
    maxTokens: 1_200,
    system: [
      {
        text: `Conviertes pedidos de reunión escritos en Slack en una propuesta estructurada para Studio Nomade (estudio de diseño y desarrollo en Chile). Hoy es ${studioDay()} (America/Santiago). Fechas relativas («el lunes», «mañana») a YYYY-MM-DD; «11.30» o «11 y media» = 11:30. Si recibes una propuesta actual y un ajuste, devuelve la propuesta completa con el ajuste aplicado y conserva el resto. No inventes correos.`,
      },
    ],
    input: [
      input.current
        ? `Propuesta actual:\n${JSON.stringify(input.current)}\n\nAjuste pedido por ${input.requester}:\n${input.text}`
        : `Pedido de ${input.requester}:\n${input.text}`,
    ].join(""),
    schema: proposalSchema,
    timeoutMs: 40_000,
  });
  return data;
}

/** Nombres sin correo → contactos de clientes o equipo (un solo match). */
async function resolveAttendees(list: Proposal["asistentes"]) {
  const resolved: { name?: string; email: string }[] = [];
  const unresolved: string[] = [];
  for (const a of list) {
    const email = uniqueEmails([a.email])[0];
    if (email) {
      resolved.push({ name: a.nombre ?? undefined, email });
      continue;
    }
    const name = (a.nombre ?? "").trim();
    if (!name) continue;
    const like = `%${name.replace(/[%_]/g, "")}%`;
    const [contacts, team] = await Promise.all([
      db
        .select({ name: clientContacts.name, email: clientContacts.email })
        .from(clientContacts)
        .where(ilike(clientContacts.name, like))
        .limit(2),
      db
        .select({ name: teamMembers.name, email: teamMembers.email })
        .from(teamMembers)
        .where(
          and(
            ilike(teamMembers.name, like),
            sql`${teamMembers.email} is not null`,
          ),
        )
        .limit(2),
    ]);
    const hits = [...team, ...contacts].filter((h) => h.email);
    const uniq = uniqueEmails(hits.map((h) => h.email));
    if (uniq.length === 1) {
      resolved.push({ name: hits[0].name ?? name, email: uniq[0] });
    } else {
      unresolved.push(name);
    }
  }
  return { resolved, unresolved };
}

async function applyProposal(
  m: StudioMeeting | null,
  p: Proposal,
  requester: string,
) {
  const area = normalizeArea(p.area);
  const { resolved, unresolved } = await resolveAttendees(p.asistentes);
  const attendees = new Map<string, { name?: string; email: string }>();
  for (const a of resolved) attendees.set(a.email, a);
  attendees.set(requester, attendees.get(requester) ?? { email: requester });
  const startsAt =
    p.fecha &&
    p.hora &&
    /^\d{4}-\d{2}-\d{2}$/.test(p.fecha) &&
    /^\d{1,2}:\d{2}$/.test(p.hora)
      ? santiagoToDate(p.fecha, p.hora.padStart(5, "0"))
      : null;
  return {
    area,
    clientName: p.cliente.trim() || "Studio Nomade",
    meetingType: p.tipo.trim() || "Reunión",
    title: meetingTitle({
      area,
      client: p.cliente || "Studio Nomade",
      type: p.tipo || "Reunión",
    }),
    startsAt: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null,
    durationMin:
      p.duracion_min > 0 && p.duracion_min <= 480
        ? p.duracion_min
        : (m?.durationMin ?? 30),
    attendees: [...attendees.values()],
    unresolved,
    agenda: p.agenda,
  };
}

function proposalCard(
  m: Pick<
    StudioMeeting,
    | "title"
    | "startsAt"
    | "durationMin"
    | "attendees"
    | "unresolved"
    | "area"
    | "clientName"
    | "meetingType"
  >,
  question: string | null,
  heading = "Propuesta de reunión",
) {
  const lines = [
    `*${heading}*`,
    `• *Título:* ${m.title}`,
    `• *Cuándo:* ${m.startsAt ? formatSlot(m.startsAt, m.durationMin) : "_falta fecha u hora_"}`,
    `• *Invitados:* ${m.attendees.map((a) => a.email).join(", ") || "—"}`,
    `• *Organiza:* operations@ con Meet (Gemini toma notas)`,
    m.startsAt
      ? `• *Carpeta:* 05_Reuniones y Minutas / ${m.area} / ${clientFolderName(m.clientName ?? "")} / ${meetingFolderName(m.startsAt, m.meetingType ?? "Reunión")}`
      : "",
    m.unresolved.length
      ? `⚠️ No encontré el correo de: ${m.unresolved.join(", ")}. Escríbelo aquí o sigo sin esa persona.`
      : "",
    question ? `❓ ${question}` : "",
    m.startsAt
      ? "Responde *ok* para agendar y enviar las invitaciones, o dime qué cambiar. *cancelar* la descarta."
      : "Dime la fecha y la hora para dejarla lista.",
  ];
  return lines.filter(Boolean).join("\n");
}

// ── Mensajes del canal ─────────────────────────────────────────

export async function handleMeetingsChannelMessage(
  event: MeetingsSlackEvent,
  eventId: string,
) {
  if (!event.user || event.bot_id || event.subtype) return;
  if (event.channel !== meetingsChannel()) return;
  if (!(await claim(eventId, event.channel))) return;
  const text = cleanSlackText(event.text ?? "");
  if (!text) return;
  const threadTs = event.thread_ts ?? event.ts;
  const reply = (msg: string) =>
    say({ slackChannelId: event.channel, slackThreadTs: threadTs }, msg);

  const email = await getSlackUserEmail(event.user).catch(() => null);
  if (!email || !slackAgentEmails().includes(email)) {
    if (!event.thread_ts) {
      await reply(
        "Por ahora solo Sebastián y Ana pueden pedir reuniones por aquí.",
      );
    }
    return;
  }
  if (!claudeConfigured()) {
    await reply("No tengo Claude configurado en este momento.");
    return;
  }

  try {
    const [existing] = event.thread_ts
      ? await db
          .select()
          .from(studioMeetings)
          .where(
            and(
              eq(studioMeetings.slackChannelId, event.channel),
              eq(studioMeetings.slackThreadTs, event.thread_ts),
            ),
          )
          .limit(1)
      : [];

    if (!existing) {
      if (event.thread_ts) return; // conversación en un hilo ajeno
      await newRequest(event.channel, threadTs, text, email);
      return;
    }
    await threadReply(existing, text, email);
  } catch (error) {
    console.error("[meetings:slack]", error);
    await reply(
      "Tuve un problema con eso. Inténtalo de nuevo en un minuto.",
    ).catch(() => undefined);
  }
}

async function newRequest(
  channel: string,
  threadTs: string,
  text: string,
  requester: string,
) {
  const p = await extractProposal({ text, requester });
  const fields = await applyProposal(null, p, requester);
  const [row] = await db
    .insert(studioMeetings)
    .values({
      slackChannelId: channel,
      slackThreadTs: threadTs,
      requesterEmail: requester,
      status: "propuesta",
      ...fields,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) return;
  await say(row, proposalCard(row, p.pregunta));
}

async function threadReply(m: StudioMeeting, text: string, author: string) {
  switch (m.status) {
    case "propuesta": {
      if (isCancel(text)) {
        await setStatus(m.id, "cancelada");
        await say(m, "Listo, la descarté. No se envió nada.");
        return;
      }
      if (isApproval(text)) {
        await schedule(m);
        return;
      }
      const p = await extractProposal({
        text,
        current: proposalOf(m),
        requester: author,
      });
      const fields = await applyProposal(m, p, m.requesterEmail);
      const [row] = await db
        .update(studioMeetings)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(studioMeetings.id, m.id))
        .returning();
      await say(row, proposalCard(row, p.pregunta, "Propuesta actualizada"));
      return;
    }
    case "agendada": {
      if (isCancel(text)) {
        if (m.calendarEventId) await cancelOpsEvent(m.calendarEventId);
        await setStatus(m.id, "cancelada");
        await say(m, "Reunión cancelada. Google avisó a los invitados.");
        return;
      }
      if (isProcessNow(text)) {
        const r = await processMeeting(m, { force: true });
        if (r !== "minuta") await say(m, notesMissingText(r));
        return;
      }
      if (isApproval(text)) {
        if (m.pendingChange) await applyChange(m);
        else
          await say(
            m,
            "Ya está agendada. Si quieres cambiar algo, dime qué (hora, invitados…), o *cancelar*.",
          );
        return;
      }
      const p = await extractProposal({
        text,
        current: proposalOf(m),
        requester: author,
      });
      const fields = await applyProposal(m, p, m.requesterEmail);
      await db
        .update(studioMeetings)
        .set({
          pendingChange: fields as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(studioMeetings.id, m.id));
      await say(
        m,
        proposalCard(
          { ...m, ...fields },
          p.pregunta,
          "Cambio propuesto (Google avisará a los invitados)",
        ),
      );
      return;
    }
    case "minuta_borrador": {
      if (isApproval(text)) {
        await approveMinutes(m);
        return;
      }
      await reviseMinutes(m, text);
      return;
    }
    case "minuta_aprobada":
      if (isApproval(text)) {
        await approveMinutes(m);
        return;
      }
      await reviseMinutes(m, text);
      return;
    default:
      await say(
        m,
        "Esta reunión ya está cerrada. Para una nueva, escribe un mensaje nuevo en el canal.",
      );
  }
}

async function setStatus(
  id: string,
  status: string,
  extra: Partial<StudioMeeting> = {},
) {
  await db
    .update(studioMeetings)
    .set({ status, ...extra, updatedAt: new Date() })
    .where(eq(studioMeetings.id, id));
}

// ── Agendar ────────────────────────────────────────────────────

async function schedule(m: StudioMeeting) {
  if (!m.startsAt) {
    await say(m, "Me falta la fecha y la hora. Dímelas y la dejo lista.");
    return;
  }
  const mailbox = await operationsMailboxStatus();
  if (!mailbox.connected || !mailbox.userId) {
    await say(
      m,
      `No puedo agendar: ${mailbox.reason ?? "la casilla de operaciones no está conectada."}`,
    );
    return;
  }
  const description = [
    m.agenda,
    "Reunión organizada por Studio Nomade · Operaciones. Gemini toma notas.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const gcal = await createCalendarEvent({
    userId: mailbox.userId,
    summary: m.title,
    description,
    startsAt: m.startsAt,
    durationMin: m.durationMin,
    attendees: m.attendees.map((a) => a.email),
  });
  if (!gcal.connected) {
    await setStatus(m.id, "propuesta", { lastError: gcal.reason });
    await say(m, `No pude crear el evento: ${gcal.reason}`);
    return;
  }
  let folderUrl: string | null = null;
  let folderId: string | null = null;
  try {
    const folder = await ensureMeetingFolder({
      area: m.area ?? "SN",
      client: m.clientName ?? "Studio Nomade",
      type: m.meetingType ?? "Reunión",
      startsAt: m.startsAt,
    });
    folderId = folder.id;
    folderUrl = folder.url;
  } catch (err) {
    console.error("[meetings:folder]", err);
  }
  await setStatus(m.id, "agendada", {
    organizerEmail: mailbox.mailbox,
    calendarEventId: gcal.eventId,
    calendarLink: gcal.htmlLink,
    meetLink: gcal.meetLink,
    driveFolderId: folderId,
    lastError: null,
  });
  await say(
    m,
    [
      `✅ *Agendada* · ${formatSlot(m.startsAt, m.durationMin)}`,
      `Invitaciones enviadas desde operations@ a ${m.attendees.length} personas.`,
      gcal.meetLink
        ? `Meet: <${gcal.meetLink}|${gcal.meetLink.replace("https://", "")}>`
        : "",
      folderUrl
        ? `Carpeta: <${folderUrl}|abrir en Drive>`
        : "⚠️ No pude crear la carpeta en Drive; la creo al procesar las notas.",
      "Al terminar, guardo las notas de Gemini en la carpeta y te dejo aquí el borrador de minuta.",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

async function applyChange(m: StudioMeeting) {
  const change = m.pendingChange as Partial<StudioMeeting> & {
    startsAt?: string | Date | null;
  };
  const startsAt = change.startsAt ? new Date(change.startsAt) : m.startsAt;
  if (!startsAt || !m.calendarEventId) {
    await say(m, "Me falta la fecha y la hora para el cambio.");
    return;
  }
  const durationMin = change.durationMin ?? m.durationMin;
  const attendees =
    (change.attendees as StudioMeeting["attendees"]) ?? m.attendees;
  const token = await requestsMailboxAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(m.calendarEventId)}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: change.title ?? m.title,
        start: {
          dateTime: startsAt.toISOString(),
          timeZone: "America/Santiago",
        },
        end: {
          dateTime: new Date(
            startsAt.getTime() + durationMin * 60_000,
          ).toISOString(),
          timeZone: "America/Santiago",
        },
        attendees: attendees.map((a) => ({ email: a.email })),
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!res.ok) {
    await say(m, `No pude actualizar el evento (HTTP ${res.status}).`);
    return;
  }
  await db
    .update(studioMeetings)
    .set({
      title: change.title ?? m.title,
      area: change.area ?? m.area,
      clientName: change.clientName ?? m.clientName,
      meetingType: change.meetingType ?? m.meetingType,
      startsAt,
      durationMin,
      attendees,
      unresolved: change.unresolved ?? m.unresolved,
      pendingChange: null,
      updatedAt: new Date(),
    })
    .where(eq(studioMeetings.id, m.id));
  await say(
    m,
    `✅ Actualizada · ${formatSlot(startsAt, durationMin)}. Google avisó a los invitados.`,
  );
}

// ── Notas y minuta ─────────────────────────────────────────────

type ProcessResult = "minuta" | "sin_notas" | "aun_no";

function notesMissingText(r: ProcessResult) {
  return r === "aun_no"
    ? "La reunión todavía no termina. Proceso las notas apenas termine."
    : "Todavía no encuentro las notas de Gemini en el Drive de operations@. Gemini puede tardar unos minutos; lo reintento solo.";
}

function dateLabel(m: StudioMeeting) {
  return m.startsAt
    ? new Intl.DateTimeFormat("es-CL", {
        timeZone: "America/Santiago",
        dateStyle: "full",
        timeStyle: "short",
      }).format(m.startsAt)
    : "";
}

async function findNotes(m: StudioMeeting) {
  if (m.notesFileId) return m.notesFileId;
  if (m.calendarEventId) {
    const att = await geminiNotesFromEvent(m.calendarEventId).catch(() => null);
    if (att) return att.fileId;
  }
  if (!m.startsAt) return null;
  const files = await searchGeminiNotes({
    sinceIso: new Date(m.startsAt.getTime() - 60 * 60_000).toISOString(),
    words: [m.clientName ?? "", ...(m.meetingType ?? "").split(/\s+/)],
  });
  const wanted = m.title.toLowerCase().slice(0, 25);
  const hit =
    files.find((f) => f.name.toLowerCase().startsWith(wanted)) ??
    files.find((f) => new Date(f.modifiedTime) >= (m.startsAt as Date));
  return hit?.id ?? null;
}

async function processMeeting(
  m: StudioMeeting,
  opts: { force?: boolean } = {},
): Promise<ProcessResult> {
  if (!m.startsAt) return "aun_no";
  const ended =
    m.startsAt.getTime() +
    (m.durationMin + (opts.force ? 0 : GRACE_MIN)) * 60_000;
  if (Date.now() < ended) return "aun_no";

  const fileId = await findNotes(m);
  if (!fileId) return "sin_notas";

  const folder = m.driveFolderId
    ? { id: m.driveFolderId }
    : await ensureMeetingFolder({
        area: m.area ?? "SN",
        client: m.clientName ?? "Studio Nomade",
        type: m.meetingType ?? "Reunión",
        startsAt: m.startsAt,
      });
  const filed = await fileIntoFolder(fileId, folder.id);
  await setStatus(m.id, "agendada", {
    notesFileId: filed.id,
    driveFolderId: folder.id,
  });

  const notes = (await readDocText(filed.id)).trim();
  if (notes.length < 200) return "sin_notas";

  const { data } = await callClaudeStructured<StudioMinutes>({
    feature: "meetings_minutes",
    model:
      process.env.DEV_MINUTES_ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5",
    effort: "medium",
    maxTokens: 6_000,
    system: [{ text: STUDIO_MINUTES_PROMPT, cache: true }],
    input: [
      `Reunión: ${m.title}`,
      `Fecha: ${dateLabel(m)}`,
      `Invitados: ${m.attendees.map((a) => (a.name ? `${a.name} <${a.email}>` : a.email)).join(", ")}`,
      "",
      "Notas y transcripción de Gemini:",
      notes.slice(0, 180_000),
    ].join("\n"),
    schema: studioMinutesSchema,
    timeoutMs: 150_000,
  });

  const signer = await signerName(m.requesterEmail);
  const { html } = renderStudioMinutes({
    title: m.title,
    dateLabel: dateLabel(m),
    data,
    signature: signer,
  });
  const doc = await createDocFromHtml({
    folderId: folder.id,
    name: `Minuta - ${m.clientName ?? "Studio Nomade"} - ${m.meetingType ?? "Reunión"} - ${meetingFolderName(m.startsAt, "").slice(0, 8)}`,
    html,
  });
  await setStatus(m.id, "minuta_borrador", {
    minutes: data as unknown as Record<string, unknown>,
    minutesDocId: doc.id,
    lastError: null,
  });
  const slackId = await lookupSlackUserByEmail(m.requesterEmail).catch(
    () => null,
  );
  const requesterSlack = slackId ? `<@${slackId}>` : m.requesterEmail;
  await say(
    m,
    [
      `📝 *Borrador de minuta · ${m.title}*`,
      minutesSlackPreview(data),
      "",
      `<${doc.url}|Abrir la minuta en Drive> · ${filed.moved ? "notas de Gemini movidas" : "copia de las notas de Gemini"} a la carpeta de la reunión.`,
      `${requesterSlack}: responde *aprobar* y te dejo el correo listo en tu Gmail (PDF adjunto), o dime qué ajustar.`,
    ].join("\n"),
  );
  return "minuta";
}

async function signerName(email: string) {
  const [member] = await db
    .select({ name: teamMembers.name })
    .from(teamMembers)
    .where(eq(teamMembers.email, email))
    .limit(1);
  return member?.name ?? "Studio Nomade";
}

async function reviseMinutes(m: StudioMeeting, instruction: string) {
  if (!m.minutes || !m.minutesDocId || !m.startsAt) return;
  const { data } = await callClaudeStructured<StudioMinutes>({
    feature: "meetings_minutes_edit",
    model: slackAgentModel(),
    effort: "low",
    maxTokens: 6_000,
    system: [{ text: STUDIO_MINUTES_PROMPT, cache: true }],
    input: `Minuta actual:\n${JSON.stringify(m.minutes)}\n\nAjuste pedido:\n${instruction}`,
    schema: studioMinutesSchema,
    timeoutMs: 90_000,
  });
  const { html } = renderStudioMinutes({
    title: m.title,
    dateLabel: dateLabel(m),
    data,
    signature: await signerName(m.requesterEmail),
  });
  await replaceDocHtml(m.minutesDocId, html);
  await setStatus(m.id, "minuta_borrador", {
    minutes: data as unknown as Record<string, unknown>,
  });
  await say(
    m,
    [
      "✏️ *Minuta ajustada*",
      minutesSlackPreview(data),
      "",
      `<https://docs.google.com/document/d/${m.minutesDocId}/edit|Abrir la minuta> · responde *aprobar* para dejar el correo en tu Gmail.`,
    ].join("\n"),
  );
}

async function approveMinutes(m: StudioMeeting) {
  if (!m.minutes || !m.minutesDocId || !m.startsAt) return;
  const sender = await studioSenderFor(m.requesterEmail);
  if (!sender) {
    await say(
      m,
      `${m.requesterEmail} no tiene Google conectado en Noma. Entra a noma.studionomade.cl › Mis conexiones y vuelve a escribir *aprobar*.`,
    );
    return;
  }
  const data = m.minutes as unknown as StudioMinutes;
  const signer = await signerName(m.requesterEmail);
  const { html, text } = renderStudioMinutes({
    title: m.title,
    dateLabel: dateLabel(m),
    data,
    signature: signer,
  });
  const subject = minutesSubject({
    client: m.clientName,
    type: m.meetingType,
    title: m.title,
    startsAt: m.startsAt,
  });
  const { to, cc } = minutesRecipients(
    m.attendees.map((a) => a.email),
    m.requesterEmail,
  );
  const pdf = await exportDocPdf(m.minutesDocId);
  try {
    const draft = await createDraftAsUser({
      userId: sender.userId,
      from: { name: signer, email: sender.email },
      to,
      cc,
      subject,
      html,
      text,
      attachments: [
        {
          filename: `${subject.replace(/[\\/:*?"<>|]+/g, "-")}.pdf`,
          mimeType: "application/pdf",
          content: pdf,
        },
      ],
    });
    await setStatus(m.id, "minuta_aprobada", { gmailDraftId: draft.draftId });
    await say(
      m,
      [
        `✅ *Borrador listo en el Gmail de ${sender.email}* (no se envió).`,
        `Para: ${to.join(", ") || "—"}${cc.length ? ` · Cc: ${cc.join(", ")}` : ""}`,
        `Asunto: ${subject} · PDF adjunto.`,
        "Revísalo en Borradores y envíalo cuando quieras.",
      ].join("\n"),
    );
  } catch (err) {
    if (err instanceof DraftScopeError) {
      await say(m, `⚠️ ${err.message}`);
      return;
    }
    throw err;
  }
}

// ── Cron ───────────────────────────────────────────────────────

/** Reuniones agendadas que terminaron → notas a la carpeta y minuta. */
export async function runStudioMeetingsCycle(opts: { deadline: number }) {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
  const rows = await db
    .select()
    .from(studioMeetings)
    .where(
      and(
        inArray(studioMeetings.status, ["agendada"]),
        sql`${studioMeetings.startsAt} >= ${since}`,
        sql`${studioMeetings.startsAt} <= now()`,
      ),
    );
  const results: { id: string; title: string; result: string }[] = [];
  for (const m of rows) {
    if (Date.now() > opts.deadline) break;
    try {
      results.push({
        id: m.id,
        title: m.title,
        result: await processMeeting(m),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "error";
      console.error("[meetings:cycle]", m.id, err);
      await setStatus(m.id, "agendada", { lastError: detail.slice(0, 500) });
      results.push({ id: m.id, title: m.title, result: `error: ${detail}` });
    }
  }
  return results;
}
