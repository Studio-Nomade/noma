import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userIntegrations } from "@/db/schema";
import { getGoogleAccessToken } from "@/features/google/auth";
import type { EmailAddress } from "./addresses";
import {
  type OutgoingAttachment,
  buildMimeMessage,
  decodeBase64Url,
  encodeBase64Url,
  generateMessageId,
  parseMessageIds,
  type GmailMessage,
} from "./mime";

/**
 * Cliente Gmail de la casilla de servicio de solicitudes
 * (NOMA_REQUESTS_MAILBOX, p. ej. la casilla de la que los alias por cliente
 * son alias de Gmail).
 *
 * Reutiliza el refresh token guardado en `user_integrations` cuando esa cuenta
 * inicia sesión en Noma. Requiere que ese login haya concedido
 * `gmail.modify` (o `gmail.readonly` + `gmail.send`): entrar con esa cuenta a
 * `/login?mailbox=requests` (ver src/features/google/scopes.ts).
 */

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_UPLOAD_API =
  "https://gmail.googleapis.com/upload/gmail/v1/users/me";

export class GmailApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "GmailApiError";
  }
}

export function requestsMailbox(): string | null {
  return process.env.NOMA_REQUESTS_MAILBOX?.trim().toLowerCase() || null;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function mailboxAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const mailbox = requestsMailbox();
  if (!mailbox) {
    throw new GmailApiError("Falta configurar NOMA_REQUESTS_MAILBOX.", 0);
  }
  const [integration] = await db
    .select({ userId: userIntegrations.userId })
    .from(userIntegrations)
    .where(eq(userIntegrations.email, mailbox))
    .limit(1);
  if (!integration) {
    throw new GmailApiError(
      `La casilla ${mailbox} no ha autorizado a Noma. Inicia sesión con ella en /login?mailbox=requests.`,
      0,
    );
  }
  const token = await getGoogleAccessToken(integration.userId);
  // Los access tokens de Google duran ~60 min; se renueva antes.
  tokenCache = { token, expiresAt: Date.now() + 45 * 60 * 1_000 };
  return token;
}

async function gmailFetch<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const token = await mailboxAccessToken();
  let res: Response;
  try {
    res = await fetch(`${GMAIL_API}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 10_000),
    });
  } catch {
    throw new GmailApiError("No se pudo conectar con Gmail.", null);
  }
  if (res.status === 401) tokenCache = null;
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new GmailApiError(
      `Gmail ${path.split("?")[0]} → HTTP ${res.status}: ${detail}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

/**
 * Envío con adjuntos: el endpoint de subida admite mensajes de hasta 35 MB
 * (el JSON con `raw` no está pensado para cuerpos grandes). Multipart: los
 * metadatos (hilo) y el mensaje RFC 822.
 */
async function gmailUploadSend(
  raw: string,
  threadId: string | null,
): Promise<{ id: string; threadId: string }> {
  const token = await mailboxAccessToken();
  const boundary = `noma_upload_${Date.now().toString(36)}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(threadId ? { threadId } : {})}\r\n--${boundary}\r\nContent-Type: message/rfc822\r\n\r\n`,
      "utf8",
    ),
    Buffer.from(raw, "utf8"),
    Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
  ]);
  let res: Response;
  try {
    res = await fetch(
      `${GMAIL_UPLOAD_API}/messages/send?uploadType=multipart`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      },
    );
  } catch {
    throw new GmailApiError("No se pudo conectar con Gmail.", null);
  }
  if (res.status === 401) tokenCache = null;
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new GmailApiError(
      `Gmail /messages/send (adjuntos) → HTTP ${res.status}: ${detail}`,
      res.status,
    );
  }
  return (await res.json()) as { id: string; threadId: string };
}

// ── Watch (Pub/Sub) ──────────────────────────────────────────
export async function watchMailbox(input: {
  topicName: string;
  labelIds?: string[];
}): Promise<{ historyId: string; expiration: Date }> {
  const result = await gmailFetch<{ historyId: string; expiration: string }>(
    "/watch",
    {
      method: "POST",
      body: {
        topicName: input.topicName,
        ...(input.labelIds?.length
          ? { labelIds: input.labelIds, labelFilterBehavior: "include" }
          : {}),
      },
    },
  );
  return {
    historyId: String(result.historyId),
    expiration: new Date(Number(result.expiration)),
  };
}

// ── History ──────────────────────────────────────────────────
export type HistoryMessage = {
  id: string;
  threadId: string;
  labelIds: string[];
};

type HistoryResponse = {
  history?: {
    id: string;
    messagesAdded?: {
      message: { id: string; threadId: string; labelIds?: string[] };
    }[];
  }[];
  historyId?: string;
  nextPageToken?: string;
};

const MAX_HISTORY_PAGES = 20;

/**
 * Mensajes agregados desde `startHistoryId`. Lanza GmailApiError 404 si el
 * historyId expiró (Gmail guarda ~1 semana): el llamador hace backfill.
 */
export async function listHistory(
  startHistoryId: string,
  labelId?: string | null,
): Promise<{ messages: HistoryMessage[]; historyId: string }> {
  const messages = new Map<string, HistoryMessage>();
  let pageToken: string | undefined;
  let latest = startHistoryId;
  let lastEntryId: string | null = null;
  for (let page = 0; page < MAX_HISTORY_PAGES; page += 1) {
    const params = new URLSearchParams({
      startHistoryId,
      historyTypes: "messageAdded",
      maxResults: "500",
    });
    if (labelId) params.set("labelId", labelId);
    if (pageToken) params.set("pageToken", pageToken);
    const res = await gmailFetch<HistoryResponse>(`/history?${params}`);
    for (const entry of res.history ?? []) {
      lastEntryId = String(entry.id);
      for (const added of entry.messagesAdded ?? []) {
        messages.set(added.message.id, {
          id: added.message.id,
          threadId: added.message.threadId,
          labelIds: added.message.labelIds ?? [],
        });
      }
    }
    if (res.historyId) latest = String(res.historyId);
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }
  // Quedaron páginas sin leer: se avanza solo hasta el último registro leído
  // para que la próxima sincronización continúe desde ahí (sin perder correos).
  if (pageToken && lastEntryId) {
    return { messages: [...messages.values()], historyId: lastEntryId };
  }
  return { messages: [...messages.values()], historyId: latest };
}

/** historyId actual de la casilla (users.getProfile). */
export async function getProfileHistoryId(): Promise<string> {
  const profile = await gmailFetch<{ historyId: string }>("/profile");
  return String(profile.historyId);
}

/** Búsqueda de respaldo (`q` de Gmail) cuando el historyId expiró. */
export async function searchMessages(
  query: string,
  max = 100,
  labelId?: string | null,
): Promise<HistoryMessage[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(Math.min(max, 500)),
  });
  if (labelId) params.set("labelIds", labelId);
  const res = await gmailFetch<{
    messages?: { id: string; threadId: string }[];
  }>(`/messages?${params}`);
  return (res.messages ?? []).map((message) => ({
    ...message,
    labelIds: [],
  }));
}

// ── Mensajes y adjuntos ──────────────────────────────────────
export async function getMessage(id: string): Promise<GmailMessage> {
  return gmailFetch<GmailMessage>(
    `/messages/${encodeURIComponent(id)}?format=full`,
  );
}

export async function getMessageIdHeader(id: string): Promise<string | null> {
  const message = await gmailFetch<GmailMessage>(
    `/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=Message-ID`,
  );
  const header = message.payload?.headers?.find(
    (item) => item.name.toLowerCase() === "message-id",
  );
  return parseMessageIds(header?.value)[0] ?? null;
}

export async function getAttachment(
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  const res = await gmailFetch<{ data?: string; size?: number }>(
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { timeoutMs: 30_000 },
  );
  if (!res.data) throw new GmailApiError("Adjunto vacío.", 404);
  return decodeBase64Url(res.data);
}

// ── Respuesta en el mismo hilo ───────────────────────────────
export type SendReplyInput = {
  /** Sin hilo: el mensaje abre uno nuevo (p. ej. «Solicitud registrada»). */
  threadId?: string | null;
  from: EmailAddress; // alias del cliente (debe estar como "Enviar como")
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  inReplyTo: string | null;
  references: string[];
  attachments?: OutgoingAttachment[];
};

/**
 * Envía un mensaje RFC 2822 dentro del hilo (`threadId` + In-Reply-To +
 * References + mismo asunto base). El From debe ser un alias configurado en
 * Gmail como "Enviar como"; si no, Gmail lo reemplaza por la casilla.
 * Devuelve el Message-ID real del enviado (para las siguientes respuestas).
 */
export async function sendReply(input: SendReplyInput): Promise<{
  id: string;
  threadId: string;
  messageId: string | null;
}> {
  const domain = input.from.email.split("@")[1] ?? "studionomade.cl";
  const generatedId = generateMessageId(domain);
  const raw = buildMimeMessage({
    from: input.from,
    to: input.to,
    cc: input.cc,
    replyTo: input.from.email,
    subject: input.subject,
    html: input.html,
    text: input.text,
    inReplyTo: input.inReplyTo,
    references: input.references,
    messageId: generatedId,
    attachments: input.attachments,
  });
  const sent = input.attachments?.length
    ? await gmailUploadSend(raw, input.threadId ?? null)
    : await gmailFetch<{ id: string; threadId: string }>("/messages/send", {
        method: "POST",
        body: {
          raw: encodeBase64Url(raw),
          ...(input.threadId ? { threadId: input.threadId } : {}),
        },
        timeoutMs: 20_000,
      });
  // Gmail puede reescribir el Message-ID; se lee el definitivo (degradable).
  const messageId = await getMessageIdHeader(sent.id).catch(() => generatedId);
  return { id: sent.id, threadId: sent.threadId, messageId };
}

/**
 * Deja un borrador de respuesta en el hilo de la casilla de servicio (no lo
 * envía). Se usa para correos que una persona debe revisar antes de salir,
 * como el aviso de solicitud fuera de alcance.
 */
export async function createDraftReply(
  input: SendReplyInput,
): Promise<{ draftId: string; messageId: string }> {
  const domain = input.from.email.split("@")[1] ?? "studionomade.cl";
  const raw = buildMimeMessage({
    from: input.from,
    to: input.to,
    cc: input.cc,
    replyTo: input.from.email,
    subject: input.subject,
    html: input.html,
    text: input.text,
    inReplyTo: input.inReplyTo,
    references: input.references,
    messageId: generateMessageId(domain),
  });
  const draft = await gmailFetch<{ id: string; message: { id: string } }>(
    "/drafts",
    {
      method: "POST",
      body: {
        message: { raw: encodeBase64Url(raw), threadId: input.threadId },
      },
      timeoutMs: 20_000,
    },
  );
  return { draftId: draft.id, messageId: draft.message.id };
}

/**
 * Borrador de un correo nuevo (fuera de un hilo) en la casilla de servicio,
 * desde el alias del cliente. Para envíos que la Dirección revisa y despacha,
 * como el informe mensual.
 */
export async function createDraft(input: {
  from: EmailAddress;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ draftId: string; messageId: string }> {
  const domain = input.from.email.split("@")[1] ?? "studionomade.cl";
  const raw = buildMimeMessage({
    from: input.from,
    to: input.to,
    cc: input.cc,
    replyTo: input.from.email,
    subject: input.subject,
    html: input.html,
    text: input.text,
    inReplyTo: null,
    references: [],
    messageId: generateMessageId(domain),
  });
  const draft = await gmailFetch<{ id: string; message: { id: string } }>(
    "/drafts",
    {
      method: "POST",
      body: { message: { raw: encodeBase64Url(raw) } },
      timeoutMs: 20_000,
    },
  );
  return { draftId: draft.id, messageId: draft.message.id };
}
