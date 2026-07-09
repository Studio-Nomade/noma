import "server-only";
import { getGoogleAccessToken, GoogleAuthError } from "./auth";

/**
 * Google Drive: lectura de documentos de notas y búsqueda de archivos recientes
 * (para el matching de notas de Gemini). Requiere el scope
 * `https://www.googleapis.com/auth/drive.readonly`.
 *
 * Toda función degrada con elegancia si falta el scope/token: devuelve
 * `{ connected: false }` en vez de romper.
 */

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string | null;
  owners: string[];
};

export type DriveNotConnected = { connected: false; reason: string };

/** Extrae el fileId de una URL de Drive/Docs, o devuelve el input si ya es un id. */
export function parseDriveId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const patterns = [
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1];
  }
  // ¿Ya es un id "pelado"?
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return null;
}

type ReadResult =
  | { connected: true; text: string; name: string; mimeType: string }
  | DriveNotConnected
  | { connected: true; error: string };

/** Lee el contenido de texto de un documento de Drive. */
export async function readDriveDoc(
  userId: string,
  urlOrId: string,
): Promise<ReadResult> {
  const fileId = parseDriveId(urlOrId);
  if (!fileId)
    return { connected: true, error: "No se reconoció el enlace de Drive." };

  let token: string;
  try {
    token = await getGoogleAccessToken(userId);
  } catch (err) {
    if (err instanceof GoogleAuthError)
      return { connected: false, reason: err.message };
    throw err;
  }
  const auth = { Authorization: `Bearer ${token}` };

  // Metadata para conocer el tipo.
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
    { headers: auth },
  );
  if (metaRes.status === 401 || metaRes.status === 403)
    return { connected: false, reason: "Falta permiso de Google Drive." };
  if (!metaRes.ok)
    return { connected: true, error: "No se pudo acceder al documento." };
  const meta = (await metaRes.json()) as { name: string; mimeType: string };

  // Google Docs → export a texto; otros → descarga directa.
  const isGoogleDoc = meta.mimeType.startsWith("application/vnd.google-apps");
  const url = isGoogleDoc
    ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`
    : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const contentRes = await fetch(url, { headers: auth });
  if (!contentRes.ok) {
    return {
      connected: true,
      error: isGoogleDoc
        ? "No se pudo exportar el documento como texto."
        : "Tipo de archivo no soportado para lectura automática.",
    };
  }
  const text = await contentRes.text();
  return { connected: true, text, name: meta.name, mimeType: meta.mimeType };
}

/** Lista documentos recientes de Drive (para el matching de notas). */
export async function searchRecentDocs(
  userId: string,
  opts: { sinceIso?: string; nameContains?: string[]; limit?: number } = {},
): Promise<{ connected: true; files: DriveFile[] } | DriveNotConnected> {
  let token: string;
  try {
    token = await getGoogleAccessToken(userId);
  } catch (err) {
    if (err instanceof GoogleAuthError)
      return { connected: false, reason: err.message };
    throw err;
  }

  const clauses = ["mimeType = 'application/vnd.google-apps.document'", "trashed = false"];
  if (opts.sinceIso) clauses.push(`modifiedTime > '${opts.sinceIso}'`);
  const names = (opts.nameContains ?? []).filter(Boolean);
  if (names.length) {
    const nameQ = names.map((n) => `name contains '${n.replace(/'/g, "")}'`);
    clauses.push(`(${nameQ.join(" or ")})`);
  }

  const params = new URLSearchParams({
    q: clauses.join(" and "),
    orderBy: "modifiedTime desc",
    pageSize: String(opts.limit ?? 20),
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,owners(emailAddress))",
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 401 || res.status === 403)
    return { connected: false, reason: "Falta permiso de Google Drive." };
  if (!res.ok) return { connected: false, reason: "Drive no respondió." };

  const json = (await res.json()) as {
    files?: {
      id: string;
      name: string;
      mimeType: string;
      modifiedTime: string;
      webViewLink?: string;
      owners?: { emailAddress: string }[];
    }[];
  };
  const files: DriveFile[] = (json.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink ?? null,
    owners: (f.owners ?? []).map((o) => o.emailAddress),
  }));
  return { connected: true, files };
}
