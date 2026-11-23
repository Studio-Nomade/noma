/**
 * Adjuntos de entregas y comentarios: la línea «Adjunto: nombre» del comando
 * se busca entre los archivos adjuntos a la tarea de Asana y viaja adjunta en
 * el correo al cliente. Módulo puro (la descarga vive en deliveries.ts).
 */

/** Tope de los adjuntos de un correo (base64 suma ~37 %: queda bajo 25 MB). */
export const MAX_ATTACHMENTS_BYTES = 18 * 1024 * 1024;

export type AvailableAttachment = {
  gid: string;
  name: string;
  size: number | null;
  /** Solo los archivos subidos a Asana se pueden descargar (no Drive/Box). */
  downloadable: boolean;
  createdAt?: string | null;
};

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function stem(value: string) {
  return fold(value).replace(/\.[a-z0-9]{1,5}$/, "");
}

/**
 * Empareja cada nombre pedido con un adjunto de la tarea: nombre exacto,
 * luego sin extensión y luego un único adjunto que lo contenga. Ante varios
 * archivos con el mismo nombre gana el más reciente.
 */
export function matchAttachments(
  requested: string[],
  available: AvailableAttachment[],
): { matched: AvailableAttachment[]; missing: string[] } {
  const newestFirst = [...available].sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );
  const matched: AvailableAttachment[] = [];
  const missing: string[] = [];
  for (const name of requested) {
    const wanted = fold(name);
    const wantedStem = stem(name);
    const exact =
      newestFirst.find((item) => fold(item.name) === wanted) ??
      newestFirst.find((item) => stem(item.name) === wantedStem);
    const partial = exact
      ? null
      : newestFirst.filter((item) => fold(item.name).includes(wantedStem));
    const found =
      exact ??
      (partial && new Set(partial.map((item) => fold(item.name))).size === 1
        ? partial[0]
        : null);
    if (found && !matched.some((item) => item.gid === found.gid)) {
      matched.push(found);
    } else if (!found) {
      missing.push(name);
    }
  }
  return { matched, missing };
}

/** «10,4 MB» / «850 KB». */
export function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  zip: "application/zip",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  html: "text/html",
  htm: "text/html",
  txt: "text/plain",
  csv: "text/csv",
  mp4: "video/mp4",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ai: "application/postscript",
  psd: "image/vnd.adobe.photoshop",
};

export function mimeTypeFor(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}
