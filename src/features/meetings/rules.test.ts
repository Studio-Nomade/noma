import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  clientFolderName,
  formatSlot,
  isApproval,
  isCancel,
  isProcessNow,
  meetingFolderName,
  meetingTitle,
  minutesRecipients,
  minutesSubject,
  normalizeArea,
  santiagoToDate,
} from "./rules";

test("hora de Santiago → UTC (verano, UTC-3)", () => {
  assert.equal(
    santiagoToDate("2026-11-30", "11:00").toISOString(),
    "2026-11-30T14:00:00.000Z",
  );
});

test("carpeta y título siguen la convención", () => {
  const at = santiagoToDate("2026-11-30", "11:00");
  assert.equal(
    meetingFolderName(at, "Chao Deudas D2C"),
    "20261130_Chao Deudas D2C",
  );
  assert.equal(clientFolderName("Idea Consultoría"), "IDEA CONSULTORÍA");
  assert.equal(
    meetingTitle({ area: "B&D", client: "Equifax", type: "Chao Deudas D2C" }),
    "B&D - Equifax | Chao Deudas D2C",
  );
  assert.match(formatSlot(at, 30), /30 de noviembre, 11:00 a 11:30/);
});

test("áreas: reconoce códigos y nombres", () => {
  assert.equal(normalizeArea("b&d"), "B&D");
  assert.equal(normalizeArea("Web Design"), "WD");
  assert.equal(normalizeArea("Audiovisual"), "A&A");
  assert.equal(normalizeArea(""), "SN");
});

test("respuestas del hilo", () => {
  assert.ok(isApproval("ok"));
  assert.ok(isApproval("Sí, dale"));
  assert.ok(isApproval("Aprobada!"));
  assert.ok(!isApproval("ok pero a las 12"));
  assert.ok(!isApproval("cambia la hora a las 12"));
  assert.ok(isCancel("cancelar"));
  assert.ok(isCancel("Cancela la reunión"));
  assert.ok(isProcessNow("procesar ahora"));
});

test("minuta: externos en Para, equipo en Cc, sin quien envía ni operations@", () => {
  const r = minutesRecipients(
    [
      "ana@studionomade.cl",
      "operations@studionomade.cl",
      "Pablo.Ahumada@equifax.com",
      "sebastian@studionomade.cl",
    ],
    "ana@studionomade.cl",
  );
  assert.deepEqual(r, {
    to: ["pablo.ahumada@equifax.com"],
    cc: ["sebastian@studionomade.cl"],
  });
  assert.equal(
    minutesSubject({
      client: "Equifax",
      type: "Chao Deudas D2C",
      title: "x",
      startsAt: santiagoToDate("2026-11-30", "11:00"),
    }),
    "Minuta | Equifax - Chao Deudas D2C - 30-11-2026",
  );
});
