import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanSubject,
  findFolioInSubject,
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
