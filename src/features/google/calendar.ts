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

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events" +
      "?conferenceDataVersion=1&sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const txt = await res.text();
    // 403/401 = scope no concedido → degrada sin romper.
    if (res.status === 401 || res.status === 403) {
      return {
        connected: false,
        reason:
          "Falta permiso de Google Calendar. Cierra sesión y vuelve a entrar para concederlo.",
      };
    }
    throw new Error(`Calendar rechazó el evento: ${txt.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    id: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: {
      entryPoints?: { entryPointType: string; uri: string }[];
    };
  };

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
