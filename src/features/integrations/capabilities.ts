/**
 * Qué puede hacer Noma con cada cuenta personal, según los permisos (scopes)
 * que la persona concedió. Módulo puro: lo usan la página «Mis conexiones» y
 * el asistente para saber qué está disponible antes de intentarlo.
 */

export type PersonalProvider = "google" | "slack" | "asana";

export type CapabilityDef = {
  id: string;
  label: string;
  /** Basta con uno de estos scopes para tener la capacidad. */
  anyOf: string[];
};

const G = "https://www.googleapis.com/auth/";

export const CAPABILITIES: Record<PersonalProvider, CapabilityDef[]> = {
  google: [
    {
      id: "gmail_send",
      label: "Enviar correos",
      anyOf: [`${G}gmail.send`, `${G}gmail.modify`, "https://mail.google.com/"],
    },
    {
      id: "gmail_read",
      label: "Leer correos",
      anyOf: [
        `${G}gmail.readonly`,
        `${G}gmail.modify`,
        "https://mail.google.com/",
      ],
    },
    {
      id: "gmail_drafts",
      label: "Dejar borradores (minutas)",
      anyOf: [
        `${G}gmail.compose`,
        `${G}gmail.modify`,
        "https://mail.google.com/",
      ],
    },
    {
      id: "calendar",
      label: "Agenda y reuniones con Meet",
      anyOf: [`${G}calendar.events`, `${G}calendar`],
    },
    {
      id: "drive",
      label: "Leer Drive y notas de Gemini",
      anyOf: [`${G}drive.readonly`, `${G}drive`],
    },
  ],
  slack: [
    {
      id: "channels",
      label: "Ver canales y no leídos",
      anyOf: ["channels:read"],
    },
    {
      id: "history",
      label: "Leer mensajes",
      anyOf: ["channels:history"],
    },
    {
      id: "dms",
      label: "Leer mensajes directos",
      anyOf: ["im:history"],
    },
    {
      id: "search",
      label: "Buscar mensajes",
      anyOf: ["search:read"],
    },
    {
      id: "send",
      label: "Escribir como tú",
      anyOf: ["chat:write"],
    },
  ],
  asana: [
    {
      id: "read",
      label: "Ver tus tareas y proyectos",
      anyOf: ["tasks:read", "default"],
    },
    {
      id: "write",
      label: "Crear y actualizar tareas",
      anyOf: ["tasks:write", "default"],
    },
    {
      id: "comment",
      label: "Comentar en tareas",
      anyOf: ["stories:write", "default"],
    },
  ],
};

/** Scopes que pedían las conexiones antiguas que no guardaron el detalle. */
export const LEGACY_SCOPES: Partial<Record<PersonalProvider, string[]>> = {
  asana: ["tasks:read", "projects:read", "users:read"],
  slack: ["channels:read", "groups:read", "im:read", "mpim:read"],
};

export type CapabilityStatus = CapabilityDef & { granted: boolean };

/** Separa una cadena de scopes (Google usa espacios, Slack comas). */
export function parseScopes(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function capabilityStatus(
  provider: PersonalProvider,
  granted: string[],
): CapabilityStatus[] {
  const set = new Set(granted);
  return CAPABILITIES[provider].map((cap) => ({
    ...cap,
    granted: cap.anyOf.some((scope) => set.has(scope)),
  }));
}

export function missingCount(statuses: CapabilityStatus[]) {
  return statuses.filter((s) => !s.granted).length;
}
