/**
 * Scopes de Google pedidos en el login (Supabase Auth → Google).
 * Módulo puro: lo usa la página de login (cliente).
 */

/** Scopes de todo usuario del estudio. */
export const GOOGLE_BASE_SCOPES = [
  "email",
  "profile",
  // gmail.send: enviar correos como el usuario (propuestas, cobranza).
  "https://www.googleapis.com/auth/gmail.send",
  // gmail.readonly: el asistente resume los correos pendientes de cada
  // persona. Scope restringido, pero la app es Interna (solo studionomade.cl)
  // y no requiere verificación de Google.
  "https://www.googleapis.com/auth/gmail.readonly",
  // gmail.compose: dejar en la casilla de la persona el borrador de la minuta
  // que aprobó en #noma-reuniones (ella lo revisa y lo envía).
  "https://www.googleapis.com/auth/gmail.compose",
  // calendar.events: crear reuniones de brief con link de Meet.
  "https://www.googleapis.com/auth/calendar.events",
  // drive.readonly: leer notas de Gemini y buscar documentos.
  "https://www.googleapis.com/auth/drive.readonly",
] as const;

/**
 * Scope extra SOLO para la casilla de solicitudes (NOMA_REQUESTS_MAILBOX):
 * leer el buzón (history/messages), registrar el watch de Pub/Sub y responder
 * en el hilo. `gmail.modify` cubre lectura + envío (sin borrado permanente);
 * equivale a `gmail.readonly` + `gmail.send`.
 *
 * Se concede entrando a /login?mailbox=requests con esa cuenta; el resto del
 * equipo nunca lo pide.
 */
export const REQUESTS_MAILBOX_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  // drive: crear la carpeta del cliente y del proyecto en las unidades
  // compartidas de cada área (proyectos nuevos de Asana).
  "https://www.googleapis.com/auth/drive",
] as const;

export const REQUESTS_MAILBOX_LOGIN_PARAM = "mailbox";
export const REQUESTS_MAILBOX_LOGIN_VALUE = "requests";

export function googleLoginScopes(includeRequestsMailbox: boolean): string {
  return [
    ...GOOGLE_BASE_SCOPES,
    ...(includeRequestsMailbox ? REQUESTS_MAILBOX_SCOPES : []),
  ].join(" ");
}
