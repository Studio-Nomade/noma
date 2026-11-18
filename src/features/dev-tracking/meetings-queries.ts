import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clientContacts,
  devMeetingTypes,
  devMeetings,
  devModules,
  userIntegrations,
} from "@/db/schema";
import { requestsMailbox } from "@/features/email/inbox";

/** Casilla de operaciones: ¿autorizó a Noma (Calendar, Drive, Gmail)? */
export async function operationsMailboxStatus() {
  const mailbox = requestsMailbox();
  if (!mailbox) {
    return {
      mailbox: null,
      userId: null,
      connected: false,
      reason: "Falta configurar NOMA_REQUESTS_MAILBOX.",
    };
  }
  const [row] = await db
    .select({ userId: userIntegrations.userId })
    .from(userIntegrations)
    .where(eq(userIntegrations.email, mailbox))
    .limit(1);
  if (!row) {
    return {
      mailbox,
      userId: null,
      connected: false,
      reason: `${mailbox} todavía no autorizó a Noma. Inicia sesión con esa cuenta en /login?mailbox=requests.`,
    };
  }
  return { mailbox, userId: row.userId, connected: true, reason: null };
}

export async function getDevMeetingsData(programId: string, clientId: string) {
  const [types, meetings, contacts] = await Promise.all([
    db
      .select()
      .from(devMeetingTypes)
      .where(
        and(
          eq(devMeetingTypes.programId, programId),
          sql`${devMeetingTypes.archivedAt} is null`,
        ),
      )
      .orderBy(asc(devMeetingTypes.sortOrder), asc(devMeetingTypes.name)),
    db
      .select()
      .from(devMeetings)
      .where(eq(devMeetings.programId, programId))
      .orderBy(desc(devMeetings.startsAt))
      .limit(60),
    db
      .select({
        id: clientContacts.id,
        name: clientContacts.name,
        email: clientContacts.email,
        role: clientContacts.role,
      })
      .from(clientContacts)
      .where(eq(clientContacts.clientId, clientId))
      .orderBy(asc(clientContacts.name)),
  ]);
  const mailbox = await operationsMailboxStatus();
  return { types, meetings, contacts, mailbox };
}

export type DevMeetingsData = Awaited<ReturnType<typeof getDevMeetingsData>>;

/**
 * Agenda previa: dónde está la pelota de cada módulo y su próximo
 * seguimiento. Texto plano para la descripción del evento.
 */
export async function buildAgenda(programId: string, template?: string | null) {
  const modules = await db
    .select({
      code: devModules.code,
      name: devModules.name,
      ballOwner: devModules.ballOwner,
      ballWhat: devModules.ballWhat,
      nextFollowUp: devModules.nextFollowUp,
      progress: devModules.progress,
    })
    .from(devModules)
    .where(
      and(
        eq(devModules.programId, programId),
        sql`${devModules.archivedAt} is null`,
      ),
    )
    .orderBy(asc(devModules.sortOrder));
  const lines: string[] = [];
  if (template?.trim()) lines.push(template.trim(), "");
  if (modules.length) {
    lines.push("Pendientes por módulo:");
    for (const m of modules) {
      const owner = m.ballOwner ? ` — la pelota está en ${m.ballOwner}` : "";
      lines.push(`• ${m.code} ${m.name} (${m.progress} %)${owner}`);
      if (m.ballWhat) lines.push(`  ${m.ballWhat}`);
    }
  }
  return lines.join("\n").trim();
}
