import { strict as assert } from "node:assert";
import { test } from "node:test";
import { geminiNotesAttachment, matchesPrefix } from "./calendar-match";

test("el prefijo ignora mayúsculas, tildes y separadores", () => {
  assert.equal(
    matchesPrefix("WD - AppsCinco | Revisión semanal", "WD - AppsCinco"),
    true,
  );
  assert.equal(
    matchesPrefix("wd – appscinco · facturación", "WD - AppsCinco"),
    true,
  );
  assert.equal(
    matchesPrefix("WD - Equifax | Revisión", "WD - AppsCinco"),
    false,
  );
  assert.equal(matchesPrefix("Algo", ""), false);
});

const ev = (
  attachments: {
    fileId: string | null;
    title: string;
    mimeType: string | null;
  }[],
) => ({
  id: "e",
  summary: "WD - AppsCinco | Revisión",
  description: null,
  startsAt: "2026-11-18T12:00:00Z",
  endsAt: "2026-11-18T13:00:00Z",
  allDay: false,
  htmlLink: null,
  meetLink: null,
  attendeeEmails: [],
  attachments: attachments.map((a) => ({ ...a, fileUrl: null })),
});

test("elige el documento de notas de Gemini entre los adjuntos", () => {
  const doc = "application/vnd.google-apps.document";
  assert.equal(
    geminiNotesAttachment(
      ev([
        { fileId: "a", title: "Contrato.pdf", mimeType: "application/pdf" },
        { fileId: "b", title: "Notas de Gemini - Revisión", mimeType: doc },
      ]),
    )?.fileId,
    "b",
  );
  assert.equal(
    geminiNotesAttachment(ev([{ fileId: "c", title: "Agenda", mimeType: doc }]))
      ?.fileId,
    "c",
  );
  assert.equal(geminiNotesAttachment(ev([])), null);
});
