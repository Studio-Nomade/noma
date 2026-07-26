import "server-only";
import { getGoogleAccessToken, GoogleAuthError } from "./auth";

/**
 * Google Calendar + Meet. Crea un evento en el calendario del usuario
 * autenticado, genera un link de Meet e invita a los participantes.
 *
 * Requiere el scope `https://www.googleapis.com/auth/calendar.events` concedido
 * al iniciar sesión. Si no está, `createCalendarEvent` devuelve
 * `{ connected: false }` para que el llamador degrade con elegancia
 * (la reunión se guarda igual, sin link de Meet).
 */

export type CalendarEventInput = {
  userId: string;
  summary: string;
  description?: string;
  startsAt: Date;
  durationMin: number;
  timeZone?: string;
  attendees: string[]; // correos (internos + externos)
};

export type CalendarEventResult =
  | {
      connected: true;
      eventId: string;
      htmlLink: string | null;
      meetLink: string | null;
    }
  | { connected: false; reason: string };

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  htmlLink: string | null;
  meetLink: string | null;
  attendeeEmails: string[];
};

export type CalendarEventsResult =
  | { connected: true; events: GoogleCalendarEvent[] }
  | { connected: false; reason: string };

/**
 * Lista instancias reales del calendario principal dentro de un rango. Expande
 * recurrencias y ordena por inicio. Nunca deja caer el dashboard: errores de
 * token, scope, red o API se convierten en estado desconectado.
 */
export async function listCalendarEvents(
  userId: string,
  from: Date,
  to: Date,
): Promise<CalendarEventsResult> {
  let token: string;
  try {
    token = await getGoogleAccessToken(userId);
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      return { connected: false, reason: err.message };
    }
    return {
      connected: false,
      reason: "No se pudo conectar con Google Calendar.",
    };
  }

  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) {
      return {
        connected: false,
        reason:
          res.status === 401 || res.status === 403
            ? "Falta permiso de Google Calendar. Reconecta Google para ver tu agenda."
            : "Google Calendar no está disponible en este momento.",
      };
    }

    const json = (await res.json()) as {
      items?: {
        id?: string;
        status?: string;
        summary?: string;
        description?: string;
        htmlLink?: string;
        hangoutLink?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
        attendees?: { email?: string }[];
      }[];
    };

    return {
      connected: true,
      events: (json.items ?? []).flatMap((event) => {
        if (
          !event.id ||
          event.status === "cancelled" ||
          (!event.start?.dateTime && !event.start?.date)
        ) {
          return [];
        }
        const allDay = !event.start.dateTime;
        return [
          {
            id: event.id,
            summary: event.summary?.trim() || "Sin título",
            description: event.description?.trim() || null,
            startsAt: event.start.dateTime ?? `${event.start.date}T00:00:00`,
            endsAt:
              event.end?.dateTime ??
              `${event.end?.date ?? event.start.date}T00:00:00`,
            allDay,
            htmlLink: event.htmlLink ?? null,
            meetLink: event.hangoutLink ?? null,
            attendeeEmails: (event.attendees ?? []).flatMap((attendee) =>
              attendee.email ? [attendee.email.toLowerCase()] : [],
            ),
          },
        ];
      }),
    };
  } catch {
    return {
      connected: false,
      reason: "No se pudo conectar con Google Calendar.",
    };
  }
}

export async function createCalendarEvent(
  input: CalendarEventInput,
): Promise<CalendarEventResult> {
  let token: string;
  try {
    token = await getGoogleAccessToken(input.userId);
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      return { connected: false, reason: err.message };
    }
    throw err;
  }

  const end = new Date(input.startsAt.getTime() + input.durationMin * 60_000);
  const timeZone = input.timeZone ?? "America/Santiago";
  const attendees = [...new Set(input.attendees.filter(Boolean))].map(
    (email) => ({ email }),
  );

  const body = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startsAt.toISOString(), timeZone },
    end: { dateTime: end.toISOString(), timeZone },
    attendees,
    conferenceData: {
      createRequest: {
        requestId: `noma-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  let res: Response;
  try {
    res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events" +
        "?conferenceDataVersion=1&sendUpdates=all",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch {
    return {
      connected: false,
      reason: "No se pudo conectar con Google Calendar.",
    };
  }

  if (!res.ok) {
    // 403/401 = scope no concedido → degrada sin romper.
    if (res.status === 401 || res.status === 403) {
      return {
        connected: false,
        reason:
          "Falta permiso de Google Calendar. Cierra sesión y vuelve a entrar para concederlo.",
      };
    }
    return {
      connected: false,
      reason: "Google Calendar no está disponible en este momento.",
    };
  }

  let json: {
    id: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: {
      entryPoints?: { entryPointType: string; uri: string }[];
    };
  };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return {
      connected: false,
      reason: "Google Calendar devolvió una respuesta inválida.",
    };
  }

  const meetFromConf = json.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video",
  )?.uri;

  return {
    connected: true,
    eventId: json.id,
    htmlLink: json.htmlLink ?? null,
    meetLink: json.hangoutLink ?? meetFromConf ?? null,
  };
}
