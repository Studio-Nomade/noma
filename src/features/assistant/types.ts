/** Tipos del resumen diario (compartidos entre servidor y UI). */

export type SourceKey = "asana" | "calendar" | "gmail" | "slack";

export type SourceResult<T> =
  { status: "ok"; items: T[] } | { status: "off"; reason: string };

export type AsanaSignal = {
  ref: string;
  name: string;
  dueOn: string | null;
  bucket: "overdue" | "today" | "tomorrow";
  url: string | null;
};

export type CalendarSignal = {
  ref: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  url: string | null;
  meetLink: string | null;
  attendees: string[];
};

export type GmailSignal = {
  ref: string;
  from: string;
  fromEmail: string;
  subject: string;
  /** Solo para el prompt: nunca se guarda. */
  snippet: string;
  receivedAt: string;
  unread: boolean;
  url: string;
};

export type SlackSignal = {
  ref: string;
  kind: "mention" | "unread";
  channel: string;
  author: string | null;
  /** Solo para el prompt: nunca se guarda. */
  text: string;
  unread: number;
  at: string | null;
  url: string | null;
};

export type BriefingSignals = {
  day: string;
  userName: string;
  asana: SourceResult<AsanaSignal>;
  calendar: SourceResult<CalendarSignal>;
  gmail: SourceResult<GmailSignal>;
  slack: SourceResult<SlackSignal>;
};

/** Lo que se guarda y se muestra (sin cuerpos de correos ni mensajes). */
export type BriefingData = {
  day: string;
  generatedAt: string;
  headline: string;
  priorities: {
    title: string;
    why: string;
    source: SourceKey;
    url: string | null;
  }[];
  suggestions: string[];
  meetings: {
    title: string;
    startsAt: string;
    allDay: boolean;
    url: string | null;
    meetLink: string | null;
  }[];
  counts: {
    asanaOverdue: number;
    asanaToday: number;
    asanaTomorrow: number;
    gmailPending: number;
    slackMentions: number;
    slackUnread: number;
  };
  sources: Record<SourceKey, { ok: boolean; reason: string | null }>;
  ai: boolean;
};
