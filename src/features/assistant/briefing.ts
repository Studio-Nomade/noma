import "server-only";

import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { assistantBriefings, teamMembers, userIntegrations } from "@/db/schema";
import { callClaudeStructured } from "@/lib/ai/claude";
import { getMyAsanaTasks } from "@/features/asana/my-tasks";
import { listCalendarEvents } from "@/features/google/calendar";
import { listPendingThreads } from "@/features/google/gmail-inbox";
import { getMySlackChannels } from "@/features/slack/my-channels";
import { getMySlackMentions } from "@/features/slack/mentions";
import { dateTimeInStudioTimeZone } from "@/features/dashboard/integrations";
import {
  assembleBriefing,
  briefingAiSchema,
  bucketFor,
  BRIEFING_SYSTEM,
  buildBriefingInput,
  type BriefingAi,
} from "./build";
import {
  addDays,
  assistantAiConfig,
  assistantPilotEmails,
  BRIEFING_TTL_DAYS,
  studioDay,
} from "./config";
import type {
  AsanaSignal,
  BriefingData,
  BriefingSignals,
  CalendarSignal,
  GmailSignal,
  SlackSignal,
  SourceResult,
} from "./types";

/**
 * Resumen diario del asistente (entrega 2 del spec 16-11). Lee las cuentas
 * personales de la persona, le pide a Claude priorizar y guarda solo el
 * resumen del día. Si Claude falla o no está configurado, sale un resumen
 * determinista: el inicio nunca queda vacío por la IA.
 */

export type BriefingUser = { id: string; email: string; name: string };

const off = (reason: string) => ({ status: "off", reason }) as const;

async function collectSignals(
  user: BriefingUser,
  day: string,
): Promise<BriefingSignals> {
  const from = dateTimeInStudioTimeZone(day, "00:00") ?? new Date();
  const to =
    dateTimeInStudioTimeZone(addDays(day, 1), "00:00") ??
    new Date(from.getTime() + 864e5);

  const [tasks, calendar, gmail, channels, mentions] = await Promise.all([
    getMyAsanaTasks(user.id).catch(() => null),
    listCalendarEvents(user.id, from, to).catch(() => null),
    listPendingThreads(user.id, user.email).catch(() => null),
    getMySlackChannels(user.id).catch(() => null),
    getMySlackMentions(user.id, addDays(day, -2)).catch(() => null),
  ]);

  const asana: SourceResult<AsanaSignal> = !tasks
    ? off("Asana no respondió.")
    : !tasks.connected
      ? off(tasks.reason)
      : {
          status: "ok",
          items: tasks.tasks
            .flatMap((t, i) => {
              const bucket = bucketFor(t.dueOn, day);
              return bucket
                ? [
                    {
                      ref: `asana:${i + 1}`,
                      name: t.name,
                      dueOn: t.dueOn,
                      bucket,
                      url: t.url,
                    },
                  ]
                : [];
            })
            .slice(0, 25),
        };

  const cal: SourceResult<CalendarSignal> = !calendar
    ? off("Google Calendar no respondió.")
    : !calendar.connected
      ? off(calendar.reason)
      : {
          status: "ok",
          items: calendar.events.slice(0, 12).map((e, i) => ({
            ref: `calendar:${i + 1}`,
            title: e.summary,
            startsAt: e.startsAt,
            endsAt: e.endsAt,
            allDay: e.allDay,
            url: e.htmlLink,
            meetLink: e.meetLink,
            attendees: e.attendeeEmails.filter((a) => a !== user.email),
          })),
        };

  const mail: SourceResult<GmailSignal> = !gmail
    ? off("Gmail no respondió.")
    : !gmail.connected
      ? off(gmail.reason)
      : {
          status: "ok",
          items: gmail.threads.map((t, i) => ({
            ref: `gmail:${i + 1}`,
            from: t.from,
            fromEmail: t.fromEmail,
            subject: t.subject,
            snippet: t.snippet,
            receivedAt: t.receivedAt,
            unread: t.unread,
            url: t.url,
          })),
        };

  let slack: SourceResult<SlackSignal>;
  if (!channels || !channels.connected) {
    slack = off(
      channels && !channels.connected ? channels.reason : "Slack no respondió.",
    );
  } else {
    const items: SlackSignal[] = [];
    if (mentions?.connected) {
      mentions.mentions.forEach((m, i) =>
        items.push({
          ref: `slack:m${i + 1}`,
          kind: "mention",
          channel: m.channel,
          author: m.author,
          text: m.text,
          unread: 0,
          at: m.at,
          url: m.url,
        }),
      );
    }
    channels.channels
      .filter((c) => c.unread > 0)
      .slice(0, 6)
      .forEach((c, i) =>
        items.push({
          ref: `slack:u${i + 1}`,
          kind: "unread",
          channel: c.name,
          author: null,
          text: "",
          unread: c.unread,
          at: null,
          url: c.url,
        }),
      );
    slack = { status: "ok", items };
  }

  return { day, userName: user.name, asana, calendar: cal, gmail: mail, slack };
}

async function prioritize(signals: BriefingSignals) {
  const config = assistantAiConfig();
  if (!config) return { ai: null, model: null };
  const hasData = [
    signals.asana,
    signals.calendar,
    signals.gmail,
    signals.slack,
  ].some((s) => s.status === "ok" && s.items.length > 0);
  if (!hasData) return { ai: null, model: null };
  try {
    const { data, model } = await callClaudeStructured<BriefingAi>({
      feature: "assistant_briefing",
      model: config.model,
      effort: config.effort,
      maxTokens: 4_000,
      system: [{ text: BRIEFING_SYSTEM, cache: true }],
      input: buildBriefingInput(signals),
      schema: briefingAiSchema,
      timeoutMs: 60_000,
    });
    return { ai: data, model };
  } catch (error) {
    console.error("[assistant:briefing] Claude", error);
    return { ai: null, model: null };
  }
}

export async function generateBriefing(
  user: BriefingUser,
  now: Date = new Date(),
): Promise<BriefingData> {
  const day = studioDay(now);
  const signals = await collectSignals(user, day);
  const { ai, model } = await prioritize(signals);
  const data = assembleBriefing(signals, ai, now);

  const expiresAt = new Date(now.getTime() + BRIEFING_TTL_DAYS * 864e5);
  const stored = data as unknown as Record<string, unknown>;
  await db
    .insert(assistantBriefings)
    .values({
      userId: user.id,
      day,
      data: stored,
      model,
      generatedAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [assistantBriefings.userId, assistantBriefings.day],
      set: { data: stored, model, generatedAt: now, expiresAt },
    });
  await db
    .delete(assistantBriefings)
    .where(lt(assistantBriefings.expiresAt, now))
    .catch(() => undefined);
  return data;
}

/** El resumen de hoy; lo genera si todavía no existe. */
export async function getTodayBriefing(
  user: BriefingUser,
): Promise<BriefingData> {
  const day = studioDay();
  const [row] = await db
    .select({ data: assistantBriefings.data })
    .from(assistantBriefings)
    .where(
      and(
        eq(assistantBriefings.userId, user.id),
        eq(assistantBriefings.day, day),
      ),
    )
    .limit(1);
  if (row) return row.data as unknown as BriefingData;
  return generateBriefing(user);
}

/** Datos mínimos de la persona a partir del usuario de Supabase. */
export function briefingUserFrom(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): BriefingUser {
  const email = (user.email ?? "").toLowerCase();
  const meta = user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    email.split("@")[0];
  return { id: user.id, email, name: fullName.split(" ")[0] };
}

/** Cron 8:30: genera el resumen de cada persona del piloto que tenga Google. */
export async function runDailyBriefings(): Promise<{
  generated: string[];
  skipped: string[];
}> {
  const emails = assistantPilotEmails();
  if (!emails.length) return { generated: [], skipped: [] };

  const rows = await db
    .select({ userId: userIntegrations.userId, email: userIntegrations.email })
    .from(userIntegrations)
    .where(inArray(userIntegrations.email, emails));
  const members = await db
    .select({ userId: teamMembers.userId, name: teamMembers.name })
    .from(teamMembers)
    .where(
      inArray(
        teamMembers.userId,
        rows.map((r) => r.userId),
      ),
    );

  const generated: string[] = [];
  const skipped = emails.filter((e) => !rows.some((r) => r.email === e));
  for (const row of rows) {
    const name =
      members.find((m) => m.userId === row.userId)?.name.split(" ")[0] ??
      (row.email ?? "").split("@")[0];
    try {
      await generateBriefing({ id: row.userId, email: row.email ?? "", name });
      generated.push(row.email ?? row.userId);
    } catch (error) {
      console.error("[assistant:cron]", row.email, error);
      skipped.push(row.email ?? row.userId);
    }
  }
  return { generated, skipped };
}
