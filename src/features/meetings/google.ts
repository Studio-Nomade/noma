import "server-only";

import { requestsMailboxAccessToken } from "@/features/email/inbox";
import {
  buildMimeMessage,
  encodeBase64Url,
  generateMessageId,
} from "@/features/email/mime";
import type { OutgoingAttachment } from "@/features/email/mime";
import { getGoogleAccessToken } from "@/features/google/auth";
import { findOrCreateFolder } from "@/features/project-setup/drive-write";
import {
  clientFolderName,
  meetingFolderName,
  meetingsDriveId,
  meetingsRootFolder,
} from "./rules";

/**
 * Google para las reuniones del estudio. Drive y Calendar con la casilla de
 * operaciones (organizadora de las reuniones y Administradora de contenido de
 * la unidad Operations); el borrador de la minuta, en la casilla de quien la
 * pidió (scope gmail.compose).
 */

const DRIVE = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const DOC_MIME = "application/vnd.google-apps.document";

async function opsFetch(url: string, init: RequestInit = {}) {
  const token = await requestsMailboxAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(
      `Google ${new URL(url).pathname} → HTTP ${res.status}: ${detail}`,
    );
  }
  return res;
}

/** `05_Reuniones y Minutas/ÁREA/CLIENTE/AAAAMMDD_Tipo`. */
export async function ensureMeetingFolder(input: {
  area: string;
  client: string;
  type: string;
  startsAt: Date;
}) {
  const driveId = meetingsDriveId();
  const area = await findOrCreateFolder({
    driveId,
    parentId: meetingsRootFolder(),
    name: input.area,
  });
  const client = await findOrCreateFolder({
    driveId,
    parentId: area.id,
    name: clientFolderName(input.client),
  });
  return findOrCreateFolder({
    driveId,
    parentId: client.id,
    name: meetingFolderName(input.startsAt, input.type),
  });
}

/**
 * Deja el archivo en la carpeta de la reunión. Lo mueve si la casilla puede
 * (notas de Gemini de operations@); si no, deja una copia.
 */
export async function fileIntoFolder(
  fileId: string,
  folderId: string,
): Promise<{ id: string; moved: boolean }> {
  const meta = (await (
    await opsFetch(
      `${DRIVE}/${fileId}?supportsAllDrives=true&fields=id,name,parents,capabilities(canMoveItemWithinDrive,canMoveItemOutOfDrive)`,
    )
  ).json()) as { id: string; name: string; parents?: string[] };
  if (meta.parents?.includes(folderId)) return { id: fileId, moved: true };
  try {
    const params = new URLSearchParams({
      addParents: folderId,
      removeParents: (meta.parents ?? []).join(","),
      supportsAllDrives: "true",
      fields: "id",
    });
    await opsFetch(`${DRIVE}/${fileId}?${params}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return { id: fileId, moved: true };
  } catch (err) {
    console.warn("[meetings:move] copia en vez de mover", err);
    const copy = (await (
      await opsFetch(
        `${DRIVE}/${fileId}/copy?supportsAllDrives=true&fields=id`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: meta.name, parents: [folderId] }),
        },
      )
    ).json()) as { id: string };
    return { id: copy.id, moved: false };
  }
}

function multipart(meta: unknown, html: string) {
  const boundary = `noma_doc_${Date.now().toString(36)}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(meta),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return { boundary, body };
}

/** Google Doc nuevo (convertido desde HTML) en la carpeta. */
export async function createDocFromHtml(input: {
  folderId: string;
  name: string;
  html: string;
}): Promise<{ id: string; url: string }> {
  const { boundary, body } = multipart(
    { name: input.name, mimeType: DOC_MIME, parents: [input.folderId] },
    input.html,
  );
  const json = (await (
    await opsFetch(
      `${DRIVE_UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`,
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    )
  ).json()) as { id: string; webViewLink?: string };
  return {
    id: json.id,
    url:
      json.webViewLink ?? `https://docs.google.com/document/d/${json.id}/edit`,
  };
}

/** Reemplaza el contenido del Doc (tras un ajuste pedido en el hilo). */
export async function replaceDocHtml(docId: string, html: string) {
  await opsFetch(
    `${DRIVE_UPLOAD}/${docId}?uploadType=media&supportsAllDrives=true`,
    {
      method: "PATCH",
      headers: { "Content-Type": "text/html; charset=UTF-8" },
      body: html,
    },
  );
}

/** PDF del Doc (para adjuntarlo al correo: Equifax no abre el Drive). */
export async function exportDocPdf(docId: string): Promise<Buffer> {
  const res = await opsFetch(
    `${DRIVE}/${docId}/export?mimeType=application/pdf`,
  );
  return Buffer.from(await res.arrayBuffer());
}

/** Texto plano de un Doc (notas de Gemini). */
export async function readDocText(fileId: string): Promise<string> {
  const res = await opsFetch(
    `${DRIVE}/${fileId}/export?mimeType=text/plain&supportsAllDrives=true`,
  );
  return res.text();
}

/** Notas de Gemini adjuntas al evento (Google las adjunta al terminar). */
export async function geminiNotesFromEvent(
  eventId: string,
): Promise<{ fileId: string; title: string } | null> {
  const res = await opsFetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?fields=attachments,status`,
  );
  const json = (await res.json()) as {
    attachments?: { fileId?: string; title?: string; mimeType?: string }[];
  };
  const doc = (json.attachments ?? []).find(
    (a) =>
      a.fileId &&
      a.mimeType === DOC_MIME &&
      /notas|notes|gemini/i.test(a.title ?? ""),
  );
  return doc?.fileId ? { fileId: doc.fileId, title: doc.title ?? "" } : null;
}

/** Busca notas de Gemini recientes en el Drive de operations@ por título. */
export async function searchGeminiNotes(input: {
  sinceIso: string;
  words: string[];
}): Promise<{ id: string; name: string; modifiedTime: string }[]> {
  const words = input.words
    .map((w) => w.replace(/'/g, ""))
    .filter((w) => w.length > 3)
    .slice(0, 4);
  const q = [
    `mimeType = '${DOC_MIME}'`,
    "trashed = false",
    `modifiedTime > '${input.sinceIso}'`,
    "(name contains 'Notas de Gemini' or name contains 'Notes by Gemini')",
    ...(words.length
      ? [`(${words.map((w) => `name contains '${w}'`).join(" or ")})`]
      : []),
  ].join(" and ");
  const params = new URLSearchParams({
    q,
    orderBy: "modifiedTime desc",
    pageSize: "10",
    fields: "files(id,name,modifiedTime)",
  });
  const json = (await (await opsFetch(`${DRIVE}?${params}`)).json()) as {
    files?: { id: string; name: string; modifiedTime: string }[];
  };
  return json.files ?? [];
}

/** Cancela el evento (avisa a los invitados). */
export async function cancelOpsEvent(eventId: string) {
  await opsFetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "DELETE" },
  );
}

export class DraftScopeError extends Error {
  constructor() {
    super(
      "Tu cuenta de Google en Noma no tiene permiso para dejar borradores. Entra a Noma › Mis conexiones › Reconectar Google y vuelve a aprobar.",
    );
    this.name = "DraftScopeError";
  }
}

/** Borrador en la casilla de la persona (no se envía). */
export async function createDraftAsUser(input: {
  userId: string;
  from: { name: string | null; email: string };
  to: string[];
  cc: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: OutgoingAttachment[];
}): Promise<{ draftId: string; url: string }> {
  const token = await getGoogleAccessToken(input.userId);
  const raw = buildMimeMessage({
    from: input.from,
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    html: input.html,
    text: input.text,
    messageId: generateMessageId("studionomade.cl"),
    attachments: input.attachments,
  });
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: { raw: encodeBase64Url(raw) } }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    },
  );
  if (res.status === 403 || res.status === 401) throw new DraftScopeError();
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Gmail /drafts → HTTP ${res.status}: ${detail}`);
  }
  const json = (await res.json()) as { id: string; message: { id: string } };
  return {
    draftId: json.id,
    url: `https://mail.google.com/mail/u/${encodeURIComponent(input.from.email)}/#drafts?compose=${json.message.id}`,
  };
}
