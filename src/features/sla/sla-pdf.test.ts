import assert from "node:assert/strict";
import test from "node:test";
import { bodyLines, lineGroups, longDate } from "./sla-pdf";
import { slaDocumentCode } from "./build-pdf-data";

test("bodyLines separa subtítulos, viñetas y párrafos", () => {
  const lines = bodyLines(
    "3.1. Servicio · Nivel Growth\n\nObjetivo: texto largo del objetivo.\n\nIncluye:\n• Uno\n- Dos\n\n\n",
  );
  assert.deepEqual(
    lines.map((l) => l.kind),
    ["subhead", "gap", "text", "gap", "subhead", "bullet", "bullet"],
  );
  assert.equal(lines[6].text, "Dos");
});

test("lineGroups deja cada subtítulo con la línea siguiente", () => {
  const groups = lineGroups(bodyLines("Intro.\n\nIncluye:\n• Uno\n• Dos"));
  assert.deepEqual(
    groups.map((g) => g.map((l) => l.kind)),
    [["text"], ["gap", "subhead", "bullet"], ["bullet"]],
  );
});

test("longDate escribe la fecha como en los SLA del Studio", () => {
  assert.equal(
    longDate("2026-05-13T15:00:00Z"),
    "Miércoles 13 de mayo de 2026",
  );
});

test("slaDocumentCode arma el código con áreas y fecha", () => {
  assert.equal(slaDocumentCode(["A&D"], new Date(2026, 10, 21)), "A&D_N261121");
  assert.equal(
    slaDocumentCode(["B&D", "WD"], new Date(2025, 10, 18)),
    "B&D+WD_N251118",
  );
});
