import "server-only";

import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { clientContacts, clients, projects, resourceLinks } from "@/db/schema";
import {
  listCalendarEvents,
  type GoogleCalendarEvent,
} from "@/features/google/calendar";
import {
  getAsanaProject,
  getAsanaTask,
  listTasks,
} from "@/features/asana/asana";
import type { Area } from "@/types/enums";

const TIME_ZONE = "America/Santiago";

export type DashboardCalendarEvent = Omit<
  GoogleCalendarEvent,
  "attendeeEmails" | "description"
> & {
  association: {
    clientId: string;
    projectId: string | null;
    label: string;
  } | null;
};

export type DashboardCalendar = {
  connected: boolean;
  reason?: string;
  events: DashboardCalendarEvent[];
  from: string;
  to: string;
};

export type MeetingProjectOption = {
  id: string;
  name: string;
  area: Area;
  clientName: string;
  contacts: { name: string | null; email: string }[];
};

export type AsanaOperationItem = {
  projectId: string;
  projectName: string;
  clientName: string;
  asanaName: string | null;
  kind: "task" | "project" | "unknown";
  url: string;
  completed: boolean | null;
  completedAt: string | null;
  progress: number | null;
};

export type AsanaOperationsSummary = {
  connected: boolean;
  reason?: string;
  items: AsanaOperationItem[];
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}@.]+/gu, " ")
    .trim();
}

function chileDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
  };
}

function offsetForDate(year: number, month: number, day: number) {
  const value = new Intl.DateTimeFormat("en", {
    timeZone: TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(Date.UTC(year, month - 1, day, 12)))
    .find((part) => part.type === "timeZoneName")?.value;
  return value?.replace("GMT", "") || "-04:00";
}

export function dateTimeInStudioTimeZone(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day || !/^\d{2}:\d{2}$/.test(time)) return null;
  const value = new Date(
    `${date}T${time}:00${offsetForDate(year, month, day)}`,
  );
  return Number.isNaN(value.getTime()) ? null : value;
}

/** Lunes 00:00 → lunes siguiente 00:00 en la zona de Studio Nomade. */
export function currentWeekRange(now = new Date()) {
  const local = chileDateParts(now);
  const anchor = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const mondayDelta = (anchor.getUTCDay() + 6) % 7;
  const monday = new Date(anchor);
  monday.setUTCDate(anchor.getUTCDate() - mondayDelta);
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(monday.getUTCDate() + 7);

  const boundary = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const dateText = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return new Date(`${dateText}T00:00:00${offsetForDate(year, month, day)}`);
  };

  return { from: boundary(monday), to: boundary(nextMonday) };
}

export async function getDashboardCalendar(
  userId: string,
): Promise<DashboardCalendar> {
  const { from, to } = currentWeekRange();
  const [calendar, projectRows, contactRows] = await Promise.all([
    listCalendarEvents(userId, from, to),
    db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: clients.id,
        clientName: clients.companyName,
        clientEmail: clients.email,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(ne(projects.status, "Cerrado")),
    db
      .select({
        clientId: clientContacts.clientId,
        email: clientContacts.email,
      })
      .from(clientContacts),
  ]);

  if (!calendar.connected) {
    return {
      connected: false,
      reason: calendar.reason,
      events: [],
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }

  const contactEmails = new Map<string, Set<string>>();
  for (const contact of contactRows) {
    const emails = contactEmails.get(contact.clientId) ?? new Set<string>();
    emails.add(contact.email.toLowerCase());
    contactEmails.set(contact.clientId, emails);
  }

  const events = calendar.events.map((event) => {
    const haystack = normalize(`${event.summary} ${event.description ?? ""}`);
    const attendees = new Set(event.attendeeEmails);
    const match = projectRows.find((project) => {
      const projectName = normalize(project.name);
      const clientName = normalize(project.clientName);
      const emails = contactEmails.get(project.clientId) ?? new Set<string>();
      if (project.clientEmail) emails.add(project.clientEmail.toLowerCase());
      return (
        (projectName.length >= 3 && haystack.includes(projectName)) ||
        (clientName.length >= 3 && haystack.includes(clientName)) ||
        [...emails].some((email) => attendees.has(email))
      );
    });
    return {
      id: event.id,
      summary: event.summary,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      htmlLink: event.htmlLink,
      meetLink: event.meetLink,
      association: match
        ? {
            clientId: match.clientId,
            projectId: match.id,
            label: `${match.clientName} · ${match.name}`,
          }
        : null,
    };
  });

  return {
    connected: true,
    events,
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export async function getMeetingProjectOptions(): Promise<
  MeetingProjectOption[]
> {
  const [projectRows, contacts] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        area: projects.area,
        clientId: clients.id,
        clientName: clients.companyName,
        clientContactName: clients.contactName,
        clientEmail: clients.email,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(ne(projects.status, "Cerrado"))
      .orderBy(asc(clients.companyName), asc(projects.name)),
    db
      .select({
        clientId: clientContacts.clientId,
        name: clientContacts.name,
        email: clientContacts.email,
      })
      .from(clientContacts)
      .orderBy(desc(clientContacts.isPrimary), asc(clientContacts.name)),
  ]);

  return projectRows.map((project) => {
    const contactMap = new Map<
      string,
      { name: string | null; email: string }
    >();
    if (project.clientEmail) {
      contactMap.set(project.clientEmail.toLowerCase(), {
        name: project.clientContactName,
        email: project.clientEmail,
      });
    }
    for (const contact of contacts) {
      if (contact.clientId === project.clientId) {
        contactMap.set(contact.email.toLowerCase(), {
          name: contact.name,
          email: contact.email,
        });
      }
    }
    return {
      id: project.id,
      name: project.name,
      area: project.area,
      clientName: project.clientName,
      contacts: [...contactMap.values()],
    };
  });
}

type AsanaTarget = { kind: "task" | "project"; gid: string };

export function parseAsanaTarget(url: string): AsanaTarget | null {
  try {
    const pathname = new URL(url).pathname;
    const namedTask = pathname.match(/\/task\/(\d+)/i)?.[1];
    if (namedTask) return { kind: "task", gid: namedTask };
    const namedProject = pathname.match(/\/project\/(\d+)/i)?.[1];
    if (namedProject) return { kind: "project", gid: namedProject };

    const classic = pathname.match(/\/0\/(\d+)(?:\/(\d+))?/);
    if (!classic) return null;
    return classic[2]
      ? { kind: "task", gid: classic[2] }
      : { kind: "project", gid: classic[1] };
  } catch {
    return null;
  }
}

export async function getAsanaOperationsSummary(): Promise<AsanaOperationsSummary> {
  const rows = await db
    .select({
      projectId: projects.id,
      projectName: projects.name,
      clientName: clients.companyName,
      linkUrl: resourceLinks.url,
      linkCreatedAt: resourceLinks.createdAt,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .innerJoin(
      resourceLinks,
      and(
        eq(resourceLinks.entityId, projects.id),
        eq(resourceLinks.entityType, "project"),
      ),
    )
    .where(
      and(
        eq(resourceLinks.type, "asana"),
        eq(projects.commercialStage, "Traspasado a operación"),
        ne(projects.status, "Cerrado"),
      ),
    )
    .orderBy(desc(resourceLinks.createdAt));

  const latestByProject = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByProject.has(row.projectId)) {
      latestByProject.set(row.projectId, row);
    }
  }
  const operations = [...latestByProject.values()];

  if (!process.env.ASANA_ACCESS_TOKEN?.trim()) {
    return {
      connected: false,
      reason: "Asana no está configurado. Agrega ASANA_ACCESS_TOKEN.",
      items: operations.map((row) => ({
        projectId: row.projectId,
        projectName: row.projectName,
        clientName: row.clientName,
        asanaName: null,
        kind: parseAsanaTarget(row.linkUrl)?.kind ?? "unknown",
        url: row.linkUrl,
        completed: null,
        completedAt: null,
        progress: null,
      })),
    };
  }

  const resolved = await Promise.all(
    operations.map(async (row): Promise<AsanaOperationItem> => {
      const target = parseAsanaTarget(row.linkUrl);
      const base = {
        projectId: row.projectId,
        projectName: row.projectName,
        clientName: row.clientName,
        url: row.linkUrl,
      };
      if (!target) {
        return {
          ...base,
          asanaName: null,
          kind: "unknown",
          completed: null,
          completedAt: null,
          progress: null,
        };
      }
      if (target.kind === "task") {
        const task = await getAsanaTask(target.gid);
        return task.connected
          ? {
              ...base,
              asanaName: task.data.name,
              kind: "task",
              completed: task.data.completed,
              completedAt: task.data.completedAt,
              progress: task.data.completed ? 100 : 0,
            }
          : {
              ...base,
              asanaName: null,
              kind: "task",
              completed: null,
              completedAt: null,
              progress: null,
            };
      }

      const [project, tasks] = await Promise.all([
        getAsanaProject(target.gid),
        listTasks(target.gid),
      ]);
      const progress =
        tasks.connected && tasks.data.length > 0
          ? Math.round(
              (tasks.data.filter((task) => task.completed).length /
                tasks.data.length) *
                100,
            )
          : null;
      return project.connected
        ? {
            ...base,
            asanaName: project.data.name,
            kind: "project",
            completed: project.data.completed,
            completedAt: project.data.completedAt,
            progress,
          }
        : {
            ...base,
            asanaName: null,
            kind: "project",
            completed: null,
            completedAt: null,
            progress,
          };
    }),
  );

  const inaccessible = resolved.some((item) => item.completed === null);
  return {
    connected: !inaccessible,
    reason: inaccessible
      ? "Algunos enlaces de Asana no se pudieron consultar. Revisa el acceso o el enlace."
      : undefined,
    items: resolved,
  };
}
