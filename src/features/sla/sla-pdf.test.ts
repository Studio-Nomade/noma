import assert from "node:assert/strict";
import test from "node:test";
import { bodyLines, lineGroups } from "./sla-pdf";

test("bodyLines separa subtítulos, viñetas y párrafos", () => {
  const lines = bodyLines(
    "3.1. Servicio · Nivel Growth\n\nObjetivo: texto largo del objetivo.\n\nIncluye:\n• Uno\n- Dos\n\n\n",
  );
  assert.deepEqual(
    lines.map((l) => l.kind),
    ["subhead", "gap", "text", "gap", "subhead", "bullet", "bullet"],
  );
  assert.equal(lines[6].text, "• Dos");
});

test("bodyLines reemplaza m² por m2 (Helvetica no trae el carácter)", () => {
  assert.equal(bodyLines("Superficie: 180 m².")[0].text, "Superficie: 180 m2.");
});

test("lineGroups deja cada subtítulo con la línea siguiente", () => {
  const groups = lineGroups(bodyLines("Intro.\n\nIncluye:\n• Uno\n• Dos"));
  assert.deepEqual(
    groups.map((g) => g.map((l) => l.kind)),
    [["text"], ["gap", "subhead", "bullet"], ["bullet"]],
  );
});
