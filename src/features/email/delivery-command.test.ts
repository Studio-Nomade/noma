import assert from "node:assert/strict";
import test from "node:test";
import { parseDeliveryCommand } from "./delivery-command";

test("reconoce ENTREGA con cualquier número y ceros a la izquierda", () => {
  assert.equal(parseDeliveryCommand("ENTREGA 01 https://x.cl")?.round, 1);
  assert.equal(parseDeliveryCommand("  ENTREGA 2: https://x.cl")?.round, 2);
  assert.equal(parseDeliveryCommand("ENTREGA 012")?.round, 12);
  assert.equal(parseDeliveryCommand("ENTREGA03")?.round, 3);
  assert.equal(parseDeliveryCommand("ENTREGA 999")?.round, 999);
});

test("solo en MAYÚSCULAS: conversación interna no dispara entregas", () => {
  for (const text of [
    "Entrega 2 queda para mañana, borrador interno https://drive.google.com/x",
    "entrega 01 https://x.cl",
    "Entrega 012",
  ]) {
    assert.equal(parseDeliveryCommand(text), null, text);
  }
});

test("no envía links internos de Asana (menciones, tareas)", () => {
  const parsed = parseDeliveryCommand(
    "ENTREGA 03 https://www.canva.com/design/abc https://app.asana.com/0/profile/1203 revisado por https://app.asana.com/0/123/456",
  );
  assert.deepEqual(parsed?.links, ["https://www.canva.com/design/abc"]);
  assert.equal(parsed?.note, "revisado por");
});

test("ignora comentarios que no son entregas", () => {
  for (const text of [
    "Revisar la ENTREGA 01 mañana",
    "ENTREGA final",
    "ENTREGA 1234",
    "ENTREGA 01abc",
    "ENTREGA 00",
    "Respuesta del cliente por correo · ENTREGA 01",
    "",
  ]) {
    assert.equal(parseDeliveryCommand(text), null, text);
  }
  assert.equal(parseDeliveryCommand(null), null);
});

test("extrae links (texto y href) y la nota del equipo", () => {
  const parsed = parseDeliveryCommand(
    "ENTREGA 02 https://drive.google.com/file/d/abc/view, https://figma.com/x.\nSe ajustó el color del CTA.\nQuedamos atentos",
    '<body>ENTREGA 02 <a href="https://drive.google.com/file/d/abc/view">link</a> <a href="https://www.canva.com/design/xyz">canva</a></body>',
  );
  assert.deepEqual(parsed, {
    round: 2,
    links: [
      "https://drive.google.com/file/d/abc/view",
      "https://figma.com/x",
      "https://www.canva.com/design/xyz",
    ],
    note: "Se ajustó el color del CTA.\nQuedamos atentos",
  });
});

test("entrega sin nota", () => {
  assert.deepEqual(parseDeliveryCommand("ENTREGA 1 - https://x.cl/a"), {
    round: 1,
    links: ["https://x.cl/a"],
    note: null,
  });
});
