import "server-only";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { slackNotifyLog, teamMembers, userIntegrations } from "@/db/schema";
import { createTask, ensureSectionByName } from "@/features/asana/asana";
import { studioDay } from "@/features/assistant/config";
import {
  getConversationMessages,
  getSlackUserEmail,
  postBotMessage,
  slackBotConfigured,
} from "@/features/slack-notify/slack-bot";
import { callClaudeStructured, claudeConfigured } from "@/lib/ai/claude";
import { runClaudeWithTools, type ClaudeTurn } from "@/lib/ai/claude-tools";
import {
  cfoProjectGid,
  cfoRequestChannel,
  cfoRequestSection,
  cleanSlackText,
  isCfoRequest,
  slackAgentEmails,
  slackAgentModel,
} from "./config";
import { slackAgentTools } from "./tools";
import { handleMeetingsChannelMessage } from "@/features/meetings/flow";
import { meetingsChannel } from "@/features/meetings/rules";

/** Evento `message` de la Events API de Slack (campos que se usan). */
export type SlackMessageEvent = {
  type: string;
  subtype?: string;
  channel: string;
  channel_type?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
};

/** Marca el evento como procesado; false si ya lo estaba (reintento). */
async function claimEvent(eventId: string, channel: string): Promise<boolean> {
  const rows = await db
    .insert(slackNotifyLog)
    .values({
      eventKey: `slack-event:${eventId}`,
      slackChannelId: channel,
      kind: "slack_agent",
    })
    .onConflictDoNothing()
    .returning({ key: slackNotifyLog.eventKey });
  return rows.length > 0;
}

/** Markdown de Claude → mrkdwn de Slack (negritas y enlaces). */
export function toSlackMrkdwn(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "<$2|$1>")
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*");
}

const SYSTEM = (
  today: string,
  name: string,
) => `Eres Noma, el asistente digital de operaciones de Studio Nomade, un estudio de diseño y desarrollo en Chile. Conversas por mensaje directo de Slack con ${name}, dueña o dueño del estudio.

Hoy es ${today} (zona America/Santiago).

Cómo respondes:
- En español de Chile, breve y concreto: primero la respuesta, después el detalle mínimo. Listas cortas cuando ayuden.
- Formato de Slack: *negrita* con un asterisco, enlaces como <url|texto>. Sin tablas ni encabezados con #.
- Usa las herramientas para cualquier dato del estudio (tareas, agenda, cobranza, clientes, solicitudes). Nunca inventes cifras, fechas ni nombres.
- Montos en pesos chilenos con punto de miles ($1.190.000).
- Por ahora solo puedes consultar. Si te piden crear una tarea, agendar una reunión o enviar un correo, explica en una línea que esa acción llega con las aprobaciones en Slack y ofrece dejar el detalle listo para cuando esté.`;

async function nomaUserFor(email: string) {
  const [row] = await db
    .select({ userId: userIntegrations.userId, email: userIntegrations.email })
    .from(userIntegrations)
    .where(eq(userIntegrations.email, email))
    .limit(1);
  if (!row) return null;
  const [member] = await db
    .select({ name: teamMembers.name })
    .from(teamMembers)
    .where(inArray(teamMembers.userId, [row.userId]))
    .limit(1);
  return {
    id: row.userId,
    email,
    name: member?.name.split(" ")[0] ?? email.split("@")[0],
  };
}

/** Conversación por mensaje directo con Sebastián o Ana. */
export async function handleDirectMessage(
  event: SlackMessageEvent,
  eventId: string,
) {
  if (!event.user || event.bot_id || event.subtype) return;
  if (!(await claimEvent(eventId, event.channel))) return;
  const reply = (text: string) =>
    postBotMessage({
      channel: event.channel,
      text: text.slice(0, 300),
      mrkdwn: toSlackMrkdwn(text),
      threadTs: event.thread_ts ?? null,
    });

  const email = await getSlackUserEmail(event.user);
  if (!email || !slackAgentEmails().includes(email)) {
    await reply(
      "Por ahora solo converso con Sebastián y Ana. Pronto se suma el resto del equipo.",
    );
    return;
  }
  const user = await nomaUserFor(email);
  if (!user) {
    await reply(
      "Para ayudarte necesito que entres una vez a Noma con tu cuenta de Google (noma.studionomade.cl).",
    );
    return;
  }
  if (!claudeConfigured()) {
    await reply("No tengo Claude configurado en este momento.");
    return;
  }

  const history = await getConversationMessages({
    channel: event.channel,
    threadTs: event.thread_ts ?? null,
    limit: 12,
  });
  const turns: ClaudeTurn[] = [];
  for (const m of history) {
    const role = m.botId ? "assistant" : "user";
    const text = cleanSlackText(m.text);
    if (!text) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role && typeof last.content === "string") {
      last.content += `\n${text}`;
    } else {
      turns.push({ role, content: text });
    }
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") {
    turns.push({ role: "user", content: cleanSlackText(event.text ?? "") });
  }

  try {
    const { text } = await runClaudeWithTools({
      feature: "slack_agent_ops",
      model: slackAgentModel(),
      system: SYSTEM(studioDay(), user.name),
      messages: turns,
      tools: slackAgentTools(user),
      maxTokens: 1_500,
      timeoutMs: 45_000,
    });
    await reply(text || "No encontré una respuesta para eso.");
  } catch (error) {
    console.error("[slack-agent:dm]", error);
    await reply(
      "Tuve un problema para responder. Inténtalo de nuevo en un minuto.",
    );
  }
}

const cfoSchema = z.object({
  titulo: z.string().describe("Título corto de la tarea, sin «[SOLICITUD]»"),
  tipo: z
    .string()
    .nullable()
    .describe("Pago, factura, compra, reembolso, cotización, trámite…"),
  cliente_proyecto: z.string().nullable(),
  descripcion: z.string(),
  monto_estimado: z.number().nullable().describe("En pesos chilenos"),
  fecha_requerida: z.string().nullable().describe("YYYY-MM-DD"),
  comentarios: z.string().nullable(),
  enlace: z.string().nullable(),
});

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** «[SOLICITUD]» en #general-finanzas → tarea en CFO (reemplaza el Zap). */
export async function handleCfoRequest(
  event: SlackMessageEvent,
  eventId: string,
) {
  if (!event.user || event.bot_id || event.subtype || event.thread_ts) return;
  if (event.channel !== cfoRequestChannel() || !isCfoRequest(event.text ?? ""))
    return;
  if (!(await claimEvent(eventId, event.channel))) return;
  const text = cleanSlackText(event.text ?? "");
  const email = await getSlackUserEmail(event.user).catch(() => null);
  try {
    const { data } = await callClaudeStructured({
      feature: "slack_cfo_request",
      effort: "low",
      model: slackAgentModel(),
      maxTokens: 800,
      system: [
        {
          text: `Extraes una solicitud a Finanzas de Studio Nomade escrita en Slack. Hoy es ${studioDay()} (Santiago). Si una fecha es relativa («el viernes»), conviértela a YYYY-MM-DD. Si un dato no está, usa null. No inventes montos.`,
        },
      ],
      input: text,
      schema: cfoSchema,
      timeoutMs: 40_000,
    });
    const section = await ensureSectionByName(
      cfoProjectGid(),
      cfoRequestSection(),
    );
    const lines = [
      data.tipo && `<strong>Tipo:</strong> ${esc(data.tipo)}`,
      data.cliente_proyecto &&
        `<strong>Cliente - Proyecto:</strong> ${esc(data.cliente_proyecto)}`,
      `<strong>Descripción:</strong> ${esc(data.descripcion)}`,
      data.monto_estimado != null &&
        `<strong>Monto estimado:</strong> $${Math.round(data.monto_estimado).toLocaleString("es-CL")}`,
      data.fecha_requerida &&
        `<strong>Fecha requerida:</strong> ${esc(data.fecha_requerida)}`,
      data.comentarios &&
        `<strong>Comentarios:</strong> ${esc(data.comentarios)}`,
      data.enlace &&
        `<strong>Enlace:</strong> <a href="${esc(data.enlace)}">${esc(data.enlace)}</a>`,
      `\nSolicitud de ${esc(email ?? "Slack")} en #general-finanzas.`,
    ].filter(Boolean);
    const task = await createTask({
      projectGid: cfoProjectGid(),
      sectionGid: section.gid,
      name: data.titulo,
      htmlNotes: `<body>${lines.join("\n")}</body>`,
      dueOn: /^\d{4}-\d{2}-\d{2}$/.test(data.fecha_requerida ?? "")
        ? data.fecha_requerida
        : null,
    });
    await postBotMessage({
      channel: event.channel,
      threadTs: event.ts,
      text: `Tarea creada en CFO: ${data.titulo}`,
      mrkdwn: `✅ Tarea creada en *CFO | Finanzas & Administración*: ${task.url ? `<${task.url}|${data.titulo}>` : data.titulo}${data.fecha_requerida ? ` · para el ${data.fecha_requerida}` : ""}`,
    });
  } catch (error) {
    console.error("[slack-agent:cfo]", error);
    await postBotMessage({
      channel: event.channel,
      threadTs: event.ts,
      text: "No pude crear la tarea en CFO",
      mrkdwn:
        "⚠️ No pude crear la tarea en CFO. Revisa el formato o créala a mano; ya quedó registrado el error.",
    }).catch(() => undefined);
  }
}

/** Despacha un evento de mensaje de Slack al flujo que corresponde. */
export async function handleSlackMessageEvent(
  event: SlackMessageEvent,
  eventId: string,
) {
  if (!slackBotConfigured()) return;
  if (event.channel_type === "im") return handleDirectMessage(event, eventId);
  if (event.channel === cfoRequestChannel())
    return handleCfoRequest(event, eventId);
  if (event.channel === meetingsChannel())
    return handleMeetingsChannelMessage(event, eventId);
}
