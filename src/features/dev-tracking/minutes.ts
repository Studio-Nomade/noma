import "server-only";

import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  devBacklog,
  devLog,
  devMeetingMinutes,
  devMeetings,
  devModules,
  devPrograms,
  devQuestions,
} from "@/db/schema";
import { callClaudeStructured, claudeConfigured } from "@/lib/ai/claude";
import { notifyTeamEvent } from "@/features/bot/notify";
import { createDraft } from "@/features/email/inbox";
import { readDriveDoc, searchRecentDocs } from "@/features/google/drive";
import { matchNotes } from "@/features/google/note-matching";
import { operationsMailboxStatus } from "./meetings-queries";
import {
  MINUTES_SYSTEM_PROMPT,
  minutesOutputSchema,
  minutesUserPrompt,
  type MinutesOutput,
} from "./minutes-schema";
import { renderMinutesEmail } from "./minutes-email";
import { detectRoadmapCode } from "./roadmap-code";

/**
 * Ciclo de minutas (F7): detectar la reunión terminada, tomar la transcripción
 * de Gemini del Drive de la casilla de operaciones, resumir con Claude, dejar
 * la minuta y las solicitudes propuestas en Noma, el borrador del correo en la
 * casilla (sin enviar) y el aviso en Slack. Nada sale al cliente.
 */

export type DigestResult = {
  meetingId: string;
  title: string;
  status:
    | "realizada"
    | "transcrita"
    | "resumida"
    | "sin_transcripcion"
    | "candidatos"
    | "sin_ia"
    | "error"
    | "dry_run";
  detail?: string;
  requests?: number;
};

const MODEL = () =>
  process.env.DEV_MINUTES_ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";
const EFFORT = () =>
  process.env.DEV_MINUTES_ANTHROPIC_EFFORT?.trim() || "medium";
/** Minutos de gracia tras el fin para dar por realizada la reunión. */
const GRACE_MIN = 10;
/** Días que se sigue buscando la transcripción antes de dejar de insistir. */
const LOOKBACK_DAYS = 7;

function todayLocal() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
  }).format(new Date());
}

/** Reuniones agendadas cuyo fin + gracia ya pasó → realizadas. */
export async function markFinishedMeetings(now = new Date()) {
  const rows = await db
    .select({
      id: devMeetings.id,
      startsAt: devMeetings.startsAt,
      durationMin: devMeetings.durationMin,
    })
    .from(devMeetings)
    .where(
      and(eq(devMeetings.status, "agendada"), lt(devMeetings.startsAt, now)),
    );
  const finished = rows.filter(
    (m) =>
      m.startsAt.getTime() + (m.durationMin + GRACE_MIN) * 60_000 <=
      now.getTime(),
  );
  if (finished.length) {
    await db
      .update(devMeetings)
      .set({ status: "realizada", updatedAt: new Date() })
      .where(
        inArray(
          devMeetings.id,
          finished.map((m) => m.id),
        ),
      );
  }
  return finished.length;
}

type MeetingRow = typeof devMeetings.$inferSelect;

async function meetingContext(meeting: MeetingRow) {
  const [program] = await db
    .select({
      id: devPrograms.id,
      name: devPrograms.name,
      projectId: devPrograms.projectId,
      clientName: clients.companyName,
    })
    .from(devPrograms)
    .innerJoin(clients, eq(clients.id, devPrograms.clientId))
    .where(eq(devPrograms.id, meeting.programId))
    .limit(1);
  const modules = await db
    .select({
      id: devModules.id,
      code: devModules.code,
      name: devModules.name,
      ballOwner: devModules.ballOwner,
    })
    .from(devModules)
    .where(
      and(
        eq(devModules.programId, meeting.programId),
        sql`${devModules.archivedAt} is null`,
      ),
    )
    .orderBy(asc(devModules.sortOrder));
  return { program, modules };
}

/** Busca la transcripción de Gemini en el Drive de la casilla y la vincula. */
export async function findTranscript(
  meeting: MeetingRow,
  opsUserId: string,
): Promise<
  | { status: "auto"; fileId: string; name: string }
  | { status: "candidates"; candidates: { fileId: string; name: string }[] }
  | { status: "not_found" }
  | { status: "disconnected"; reason: string }
> {
  const { program } = await meetingContext(meeting);
  const since = new Date(
    meeting.startsAt.getTime() - 60 * 60_000,
  ).toISOString();
  const titleWords = meeting.title
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 3)
    .slice(0, 3);
  const res = await searchRecentDocs(opsUserId, {
    sinceIso: since,
    nameContains: ["Notas", "Notes", "Gemini", ...titleWords],
    limit: 25,
  });
  if (!res.connected) return { status: "disconnected", reason: res.reason };
  const match = matchNotes(res.files, {
    clientName: program?.clientName ?? "",
    projectName: program?.name ?? "",
    meetingTitle: meeting.title,
    meetingDate: new Date(
      meeting.startsAt.getTime() + meeting.durationMin * 60_000,
    ).toISOString(),
    organizerEmail: meeting.organizerEmail,
    participantEmails: meeting.attendees.map((a) => a.email),
  });
  if (match.status === "auto") {
    const top = match.candidates[0];
    return { status: "auto", fileId: top.fileId, name: top.name };
  }
  if (match.status === "candidates") {
    return {
      status: "candidates",
      candidates: match.candidates.map((c) => ({
        fileId: c.fileId,
        name: c.name,
      })),
    };
  }
  return { status: "not_found" };
}

/** Guarda minuta, solicitudes propuestas y preguntas (reemplaza lo anterior). */
export async function persistMinutes(
  meeting: MeetingRow,
  data: MinutesOutput,
  model: string | null,
  modules: { id: string; code: string }[],
  actorId?: string | null,
) {
  const today = todayLocal();
  const moduleByCode = new Map(
    modules.map((m) => [m.code.toUpperCase(), m.id]),
  );

  // Numeración por prefijo dentro de la reunión: OP-01, OP-02, CO-01…
  const counters = new Map<string, number>();
  const backlogRows = data.solicitudes.map((s, i) => {
    const prefix =
      s.prefijo
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 3) || "GE";
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    const code = `${prefix}-${String(n).padStart(2, "0")}`;
    const roadmapCode = s.roadmap_o_modulo
      ? (detectRoadmapCode(s.roadmap_o_modulo) ??
        s.roadmap_o_modulo.toUpperCase())
      : null;
    const moduleId = roadmapCode
      ? (moduleByCode.get(roadmapCode.toUpperCase()) ?? null)
      : null;
    return {
      programId: meeting.programId,
      meetingId: meeting.id,
      code,
      title: s.titulo,
      detail: s.detalle,
      raisedBy: s.planteada_por ?? null,
      area: s.area,
      type: s.tipo,
      environment: s.entorno,
      priority: s.prioridad_sugerida,
      evidence: s.evidencia ?? null,
      destination: s.destino_sugerido,
      roadmapCode,
      moduleId,
      dependencies: s.dependencias ?? [],
      status: "propuesta",
      sortOrder: i,
      createdBy: actorId ?? null,
    };
  });

  await db.transaction(async (tx) => {
    // Reprocesar reemplaza la minuta anterior y sus propuestas no tocadas.
    await tx
      .delete(devMeetingMinutes)
      .where(eq(devMeetingMinutes.meetingId, meeting.id));
    await tx
      .delete(devBacklog)
      .where(
        and(
          eq(devBacklog.meetingId, meeting.id),
          eq(devBacklog.status, "propuesta"),
        ),
      );
    await tx
      .delete(devQuestions)
      .where(
        and(
          eq(devQuestions.meetingId, meeting.id),
          eq(devQuestions.status, "abierta"),
        ),
      );

    await tx.insert(devMeetingMinutes).values({
      meetingId: meeting.id,
      programId: meeting.programId,
      summary: data.resumen,
      attendees: data.asistentes.map((a) => ({
        name: a.nombre,
        area: a.area,
        role: a.rol,
      })),
      topics: data.temas.map((t) => ({
        title: t.titulo,
        detail: t.detalle,
        minute: t.minuto,
      })),
      agreements: data.acuerdos,
      pendingDecisions: data.decisiones_pendientes,
      confirmedNoDev: data.confirmado_sin_desarrollo,
      quotedFigures: data.cifras_dichas.map((c) => ({
        text: c.texto,
        status: "dicho" as const,
        note: c.contexto,
      })),
      model,
      status: "borrador",
      createdBy: actorId ?? null,
    });
    if (backlogRows.length) await tx.insert(devBacklog).values(backlogRows);
    if (data.preguntas_abiertas.length) {
      await tx.insert(devQuestions).values(
        data.preguntas_abiertas.map((q) => ({
          programId: meeting.programId,
          meetingId: meeting.id,
          question: q.pregunta,
          forWhom: q.para,
          since: today,
          blocks: q.bloquea ?? null,
          status: "abierta",
          source: "reunion",
          createdBy: actorId ?? null,
        })),
      );
    }
    await tx
      .update(devMeetings)
      .set({ status: "resumida", updatedAt: new Date() })
      .where(eq(devMeetings.id, meeting.id));
    await tx
      .insert(devLog)
      .values({
        programId: meeting.programId,
        date: today,
        text: `Minuta generada: ${meeting.title} · ${backlogRows.length} solicitudes propuestas, ${data.preguntas_abiertas.length} preguntas abiertas`,
        source: "claude",
      })
      .onConflictDoNothing();
  });

  return backlogRows;
}

/** Resume la transcripción y deja minuta, solicitudes, preguntas, borrador y aviso. */
export async function summarizeMeeting(
  meetingId: string,
  opts: { dryRun?: boolean; actorId?: string | null } = {},
): Promise<DigestResult> {
  const [meeting] = await db
    .select()
    .from(devMeetings)
    .where(eq(devMeetings.id, meetingId))
    .limit(1);
  if (!meeting)
    return { meetingId, title: "?", status: "error", detail: "No existe." };
  if (!meeting.transcriptFileId) {
    return { meetingId, title: meeting.title, status: "sin_transcripcion" };
  }
  const mailbox = await operationsMailboxStatus();
  if (!mailbox.connected || !mailbox.userId) {
    return {
      meetingId,
      title: meeting.title,
      status: "error",
      detail: mailbox.reason ?? "Casilla no conectada.",
    };
  }
  if (!claudeConfigured()) {
    return { meetingId, title: meeting.title, status: "sin_ia" };
  }

  const doc = await readDriveDoc(mailbox.userId, meeting.transcriptFileId);
  if (!doc.connected || "error" in doc) {
    return {
      meetingId,
      title: meeting.title,
      status: "error",
      detail: "error" in doc ? doc.error : doc.reason,
    };
  }
  const transcript = doc.text.trim();
  if (transcript.length < 200) {
    return {
      meetingId,
      title: meeting.title,
      status: "error",
      detail: "La transcripción está vacía o demasiado corta.",
    };
  }

  const { program, modules } = await meetingContext(meeting);
  const meetingDate = meeting.startsAt.toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    dateStyle: "long",
    timeStyle: "short",
  });
  const input = minutesUserPrompt({
    meetingTitle: meeting.title,
    meetingDate,
    programName: program?.name ?? "",
    clientName: program?.clientName ?? "",
    attendees: meeting.attendees,
    modules,
    transcript: transcript.slice(0, 180_000),
  });
  if (opts.dryRun) {
    return { meetingId, title: meeting.title, status: "dry_run" };
  }

  const { data, model } = await callClaudeStructured<MinutesOutput>({
    feature: "dev_minutes",
    model: MODEL(),
    effort: EFFORT(),
    maxTokens: 8_192,
    system: [{ text: MINUTES_SYSTEM_PROMPT, cache: true }],
    input,
    schema: minutesOutputSchema,
    timeoutMs: 150_000,
  });

  const backlogRows = await persistMinutes(
    meeting,
    data,
    model,
    modules,
    opts.actorId,
  );

  // Borrador del correo en la casilla de operaciones (no se envía).
  let draftId: string | null = null;
  try {
    const email = renderMinutesEmail({
      meetingTitle: meeting.title,
      meetingDate,
      programName: program?.name ?? "",
      data,
      codes: backlogRows.map((r) => r.code),
    });
    const draft = await createDraft({
      from: { name: "Studio Nomade · Operaciones", email: mailbox.mailbox! },
      to: meeting.attendees.map((a) => a.email),
      subject: `Minuta · ${meeting.title} · ${meeting.startsAt.toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}`,
      html: email.html,
      text: email.text,
    });
    draftId = draft.draftId;
    await db
      .update(devMeetingMinutes)
      .set({ gmailDraftId: draftId, updatedAt: new Date() })
      .where(eq(devMeetingMinutes.meetingId, meeting.id));
  } catch (err) {
    console.error("[dev-minutes:draft]", err);
  }

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
  const link = program
    ? `${appUrl}/projects/${program.projectId}/seguimiento/reuniones/${meeting.id}`
    : "";
  await notifyTeamEvent({
    text: `Minuta lista: ${meeting.title}`,
    body: [
      `*Minuta lista · ${meeting.title}*`,
      `${backlogRows.length} solicitudes propuestas · ${data.preguntas_abiertas.length} preguntas abiertas${draftId ? " · borrador en la casilla" : ""}`,
      link ? `<${link}|Revisar y aprobar en Noma>` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return {
    meetingId,
    title: meeting.title,
    status: "resumida",
    requests: backlogRows.length,
  };
}

/** Corrida completa del cron: marcar realizadas, buscar transcripción, resumir. */
export async function runMeetingsDigest(opts: {
  deadline: number;
  dryRun?: boolean;
  meetingId?: string | null;
}): Promise<DigestResult[]> {
  const results: DigestResult[] = [];
  await markFinishedMeetings();
  const mailbox = await operationsMailboxStatus();
  if (!mailbox.connected || !mailbox.userId) {
    return [
      {
        meetingId: "-",
        title: "-",
        status: "error",
        detail: mailbox.reason ?? "Casilla no conectada.",
      },
    ];
  }
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
  const pending = await db
    .select()
    .from(devMeetings)
    .where(
      opts.meetingId
        ? eq(devMeetings.id, opts.meetingId)
        : and(
            inArray(devMeetings.status, ["realizada", "transcrita"]),
            sql`${devMeetings.startsAt} >= ${since}`,
          ),
    )
    .orderBy(asc(devMeetings.startsAt));

  for (const meeting of pending) {
    if (Date.now() > opts.deadline) break;
    try {
      let fileId = meeting.transcriptFileId;
      if (!fileId) {
        const found = await findTranscript(meeting, mailbox.userId);
        if (found.status === "auto") {
          fileId = found.fileId;
          if (!opts.dryRun) {
            await db
              .update(devMeetings)
              .set({
                transcriptFileId: fileId,
                status: "transcrita",
                updatedAt: new Date(),
              })
              .where(eq(devMeetings.id, meeting.id));
          }
        } else if (found.status === "candidates") {
          results.push({
            meetingId: meeting.id,
            title: meeting.title,
            status: "candidatos",
            detail: found.candidates.map((c) => c.name).join(" · "),
          });
          continue;
        } else if (found.status === "disconnected") {
          results.push({
            meetingId: meeting.id,
            title: meeting.title,
            status: "error",
            detail: found.reason,
          });
          continue;
        } else {
          results.push({
            meetingId: meeting.id,
            title: meeting.title,
            status: "sin_transcripcion",
          });
          continue;
        }
      }
      if (opts.dryRun) {
        results.push({
          meetingId: meeting.id,
          title: meeting.title,
          status: "dry_run",
        });
        continue;
      }
      results.push(await summarizeMeeting(meeting.id));
    } catch (err) {
      console.error("[dev-minutes]", meeting.id, err);
      results.push({
        meetingId: meeting.id,
        title: meeting.title,
        status: "error",
        detail: err instanceof Error ? err.message : "Error desconocido.",
      });
    }
  }
  return results;
}
