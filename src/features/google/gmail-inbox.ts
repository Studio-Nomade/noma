import "server-only";
import { getGoogleAccessToken, GoogleAuthError } from "./auth";
import { googleDenialFromResponse } from "./errors";

/**
 * Lectura del buzón de la persona para su resumen diario (scope
 * `gmail.readonly` o `gmail.modify`). Solo metadatos y el fragmento que da
 * Gmail; nunca el cuerpo completo. Hilos de los últimos días cuyo último
 * mensaje no es de la persona (es decir, esperan respuesta).
 */

export type PendingThread = {
  threadId: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  unread: boolean;
  url: string;
};

export type PendingThreadsResult =
  | { connected: true; threads: PendingThread[] }
  | { connected: false; reason: string };

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const QUERY =
  "in:inbox newer_than:3d -category:promotions -category:social -category:updates -category:forums";

type GmailHeader = { name?: string; value?: string };
type GmailMessage = {
  id?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: GmailHeader[] };
};

function header(message: GmailMessage, name: string) {
  return (
    message.payload?.headers?.find(
      (h) => h.name?.toLowerCase() === name.toLowerCase(),
    )?.value ?? ""
  );
}

/** «Paulina Soto <psoto@x.cl>» → nombre y correo. */
export function parseFrom(value: string): { name: string; email: string } {
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const email = match[2].trim().toLowerCase();
    return { name: match[1].trim() || email, email };
  }
  const email = value.trim().toLowerCase();
  return { name: email, email };
}

function decodeEntities(text: string) {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function listPendingThreads(
  userId: string,
  userEmail: string,
  limit = 12,
): Promise<PendingThreadsResult> {
  let token: string;
  try {
    token = await getGoogleAccessToken(userId);
  } catch (err) {
    if (err instanceof GoogleAuthError)
      return { connected: false, reason: err.message };
    throw err;
  }
  const auth = { Authorization: `Bearer ${token}` };
  const params = new URLSearchParams({ q: QUERY, maxResults: "20" });
  const list = await fetch(`${API}/threads?${params}`, {
    headers: auth,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (list.status === 401 || list.status === 403) {
    const denial = await googleDenialFromResponse(list, "Gmail");
    return { connected: false, reason: denial.message };
  }
  if (!list.ok) return { connected: false, reason: "Gmail no respondió." };
  const { threads = [] } = (await list.json()) as {
    threads?: { id?: string }[];
  };

  const me = userEmail.toLowerCase();
  const detailed = await Promise.all(
    threads
      .filter((t): t is { id: string } => Boolean(t.id))
      .map(async (t) => {
        const q = new URLSearchParams({ format: "metadata" });
        for (const h of ["From", "Subject"]) q.append("metadataHeaders", h);
        const res = await fetch(`${API}/threads/${t.id}?${q}`, {
          headers: auth,
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        }).catch(() => null);
        if (!res?.ok) return null;
        const thread = (await res.json()) as { messages?: GmailMessage[] };
        const messages = thread.messages ?? [];
        const last = messages.at(-1);
        if (!last) return null;
        const from = parseFrom(header(last, "From"));
        // Si lo último lo escribió la persona, el hilo no espera respuesta.
        if (from.email === me) return null;
        const first = messages[0];
        return {
          threadId: t.id,
          from: from.name,
          fromEmail: from.email,
          subject: header(first, "Subject") || "(sin asunto)",
          snippet: decodeEntities(last.snippet ?? ""),
          receivedAt: new Date(Number(last.internalDate ?? 0)).toISOString(),
          unread: messages.some((m) => m.labelIds?.includes("UNREAD")),
          url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(me)}#all/${t.id}`,
        } satisfies PendingThread;
      }),
  );

  return {
    connected: true,
    threads: detailed
      .filter((t): t is PendingThread => Boolean(t))
      .slice(0, limit),
  };
}
