import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanSubject,
  findFolioInSubject,
  folioMonth,
  formatFolio,
  replySubject,
} from "./folio";

test("formatea folios con 4 dígitos mínimo", () => {
  assert.equal(formatFolio("EQ", 142), "EQ-0142");
  assert.equal(formatFolio("g360", 7), "G360-0007");
  assert.equal(formatFolio("H5", 12345), "H5-12345");
  assert.throws(() => formatFolio("1X", 1));
  assert.throws(() => formatFolio("EQ", 0));
});

test("agrega el mes de ingreso en America/Santiago", () => {
  assert.equal(
    formatFolio("G360", 42, new Date("2026-11-09T15:06:00Z")),
    "G360-NOV-0042",
  );
  // 1 de diciembre 01:00 UTC sigue siendo 30 de noviembre en Santiago.
  assert.equal(
    formatFolio("EQ", 7, new Date("2026-12-01T01:00:00Z")),
    "EQ-NOV-0007",
  );
  assert.equal(folioMonth(new Date("2026-03-15T12:00:00Z")), "MAR");
});

test("encuentra el folio con mes en el asunto", () => {
  assert.equal(
    findFolioInSubject("Re: Video LinkedIn [G360-NOV-0042]"),
    "G360-NOV-0042",
  );
  assert.equal(
    findFolioInSubject("RE: [g360-dic-0050] ajustes"),
    "G360-DIC-0050",
  );
  assert.equal(findFolioInSubject("Banner [G360-XYZ-0042]"), null);
  assert.equal(
    cleanSubject("Re: Video LinkedIn [G360-NOV-0042]"),
    "Video LinkedIn",
  );
  assert.equal(
    replySubject("Re: Video [G360-NOV-0042]", "G360-NOV-0042"),
    "Re: Video [G360-NOV-0042]",
  );
});

test("encuentra el folio en el asunto", () => {
  assert.equal(findFolioInSubject("RE: Banner cyber [EQ-0142]"), "EQ-0142");
  assert.equal(findFolioInSubject("Re: [g360-0007] ajustes"), "G360-0007");
  assert.equal(findFolioInSubject("Banner [EQ-142]"), null);
  assert.equal(findFolioInSubject("Sin folio"), null);
  assert.equal(findFolioInSubject(null), null);
});

test("limpia prefijos de respuesta y folios", () => {
  assert.equal(cleanSubject("RE: Fwd: RV: Banner cyber"), "Banner cyber");
  assert.equal(cleanSubject("Re: Banner cyber [EQ-0142]"), "Banner cyber");
  assert.equal(cleanSubject("Revisión: banner"), "Revisión: banner");
});

test("arma el asunto de respuesta con folio una sola vez", () => {
  assert.equal(
    replySubject("Banner cyber", "EQ-0142"),
    "Re: Banner cyber [EQ-0142]",
  );
  assert.equal(
    replySubject("RE: Banner cyber [EQ-0142]", "EQ-0142"),
    "Re: Banner cyber [EQ-0142]",
  );
  assert.equal(replySubject("", "EQ-0001"), "Re: Solicitud [EQ-0001]");
});
