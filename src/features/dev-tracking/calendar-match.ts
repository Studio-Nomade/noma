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

/** Documento de notas de Gemini adjunto al evento, si lo hay. */
export function geminiNotesAttachment(event: GoogleCalendarEvent) {
  const docs = (event.attachments ?? []).filter(
    (a) => a.fileId && (a.mimeType === DOC_MIME || !a.mimeType),
  );
  const notes = docs.find((a) => /notas|notes|gemini|transcri/i.test(a.title));
  return notes ?? (docs.length === 1 ? docs[0] : null);
}
