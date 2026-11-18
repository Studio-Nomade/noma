import "server-only";

import { requestsMailboxAccessToken } from "@/features/email/inbox";
import { fold } from "./rules";

/**
 * Escritura mínima en Drive con la casilla de servicio (operations@), que es
 * Administrador de contenido en las unidades compartidas de las áreas.
 * Requiere el scope `drive` (entrar a /login?mailbox=requests).
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const FOLDER = "application/vnd.google-apps.folder";

export type DriveFolder = { id: string; name: string; url: string };

async function drive<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  const token = await requestsMailboxAccessToken();
  const res = await fetch(`${DRIVE_API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Drive → HTTP ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

function toFolder(file: { id: string; name: string }): DriveFolder {
  return {
    id: file.id,
    name: file.name,
    url: `https://drive.google.com/drive/folders/${file.id}`,
  };
}

/** Subcarpetas directas de `parentId` en la unidad compartida. */
async function childFolders(driveId: string, parentId: string) {
  const out: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      q: `'${parentId}' in parents and mimeType = '${FOLDER}' and trashed = false`,
      corpora: "drive",
      driveId,
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
      fields: "nextPageToken, files(id, name)",
      pageSize: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await drive<{
      files: { id: string; name: string }[];
      nextPageToken?: string;
    }>(`?${params}`);
    out.push(...data.files);
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

/**
 * Carpeta `name` dentro de `parentId` (raíz de la unidad si es la unidad):
 * la reutiliza si ya existe (sin importar mayúsculas ni tildes) o la crea.
 */
export async function findOrCreateFolder(input: {
  driveId: string;
  parentId: string;
  name: string;
}): Promise<DriveFolder & { created: boolean }> {
  const wanted = fold(input.name);
  const existing = (await childFolders(input.driveId, input.parentId)).find(
    (folder) => fold(folder.name) === wanted,
  );
  if (existing) return { ...toFolder(existing), created: false };
  const created = await drive<{ id: string; name: string }>(
    "?supportsAllDrives=true&fields=id,name",
    {
      method: "POST",
      body: { name: input.name, mimeType: FOLDER, parents: [input.parentId] },
    },
  );
  return { ...toFolder(created), created: true };
}
