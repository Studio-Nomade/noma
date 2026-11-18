import type { GoogleCalendarEvent } from "@/features/google/calendar";

/** Coincidencia de título y notas de Gemini adjuntas (módulo puro). */

const DOC_MIME = "application/vnd.google-apps.document";

function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[\s|·:–—-]+/g, " ")
    .trim();
}

export function matchesPrefix(summary: string, prefix: string) {
  const p = fold(prefix);
  return p.length > 0 && fold(summary).startsWith(p);
}

/** ID de un documento de Drive a partir de su enlace (`/document/d/<id>`). */
export function driveIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m =
    url.match(/\/d\/([a-zA-Z0-9_-]{20,})/) ??
    url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : null;
}

/** Documento de notas de Gemini adjunto al evento, si lo hay. */
export function geminiNotesAttachment(event: GoogleCalendarEvent) {
  const docs = (event.attachments ?? [])
    .map((a) => ({ ...a, fileId: a.fileId ?? driveIdFromUrl(a.fileUrl) }))
    .filter(
      (a) =>
        a.fileId &&
        (a.mimeType === DOC_MIME ||
          (!a.mimeType &&
            /docs\.google\.com\/document/.test(a.fileUrl ?? "")) ||
          (!a.mimeType && !a.fileUrl)),
    );
  const notes = docs.find((a) => /notas|notes|gemini|transcri/i.test(a.title));
  return notes ?? (docs.length === 1 ? docs[0] : null);
}
