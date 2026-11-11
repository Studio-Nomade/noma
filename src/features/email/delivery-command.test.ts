import assert from "node:assert/strict";
import test from "node:test";
import { parseConsultaCommand, parseDeliveryCommand } from "./delivery-command";

test("reconoce ENTREGA con cualquier número y ceros a la izquierda", () => {
  assert.equal(parseDeliveryCommand("ENTREGA 01 https://x.cl")?.round, 1);
  assert.equal(parseDeliveryCommand("  ENTREGA 2: https://x.cl")?.round, 2);
  assert.equal(parseDeliveryCommand("ENTREGA 012")?.round, 12);
  assert.equal(parseDeliveryCommand("ENTREGA03")?.round, 3);
  assert.equal(parseDeliveryCommand("ENTREGA 999")?.round, 999);
});

test("conversación interna no dispara entregas", () => {
  for (const text of [
    "Entrega 2 queda para mañana, borrador interno https://drive.google.com/x",
    "entrega 01 https://x.cl",
    "Entrega 012",
    "Entrega 01:",
    "Entrega 01:\nfalta exportar, lo subo en la tarde",
    "Entrega 01: https://app.asana.com/0/123/456",
  ]) {
    assert.equal(parseDeliveryCommand(text), null, text);
  }
});

test("acepta «Entrega 01» en minúsculas como primera línea completa con link", () => {
  const parsed = parseDeliveryCommand(
    "Entrega 01:\nhttps://drive.google.com/drive/folders/1ENRN?usp=drive_link",
  );
  assert.equal(parsed?.round, 1);
  assert.deepEqual(parsed?.links, [
    "https://drive.google.com/drive/folders/1ENRN?usp=drive_link",
  ]);
  assert.equal(
    parseDeliveryCommand("entrega 2\nVideo: https://drive.google.com/a")?.round,
    2,
  );
  assert.equal(
    parseDeliveryCommand(
      "Entrega 03",
      '<body>Entrega 03\n<a href="https://www.canva.com/design/xyz">diseño</a></body>',
    )?.round,
    3,
  );
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
    files: [
      {
        label: "Google Drive",
        url: "https://drive.google.com/file/d/abc/view",
        detail: null,
      },
      { label: "Figma", url: "https://figma.com/x", detail: null },
      { label: "canva", url: "https://www.canva.com/design/xyz", detail: null },
    ],
    note: "Se ajustó el color del CTA.\nQuedamos atentos",
  });
});

test("entrega sin nota", () => {
  assert.deepEqual(parseDeliveryCommand("ENTREGA 1 - https://x.cl/a"), {
    round: 1,
    links: ["https://x.cl/a"],
    files: [{ label: "Archivo 01", url: "https://x.cl/a", detail: null }],
    note: null,
  });
});

test("lee un archivo por línea con nombre y detalle", () => {
  const parsed = parseDeliveryCommand(
    "ENTREGA 01\nVideo resumen 16:9 (1:32, con subtítulos): https://drive.google.com/a\n- Miniatura LinkedIn: https://drive.google.com/b\nUsamos música de librería.",
  );
  assert.deepEqual(parsed?.files, [
    {
      label: "Video resumen 16:9",
      url: "https://drive.google.com/a",
      detail: "1:32, con subtítulos",
    },
    {
      label: "Miniatura LinkedIn",
      url: "https://drive.google.com/b",
      detail: null,
    },
  ]);
  assert.equal(parsed?.note, "Usamos música de librería.");
});

test("CONSULTA: preguntas por línea, ayuda entre paréntesis y BLOQUEA", () => {
  assert.deepEqual(
    parseConsultaCommand(
      "CONSULTA\n¿Música de librería o pista del evento? (si es del evento, basta el enlace)\n- ¿Logos juntos en el cierre?",
    ),
    {
      blocking: false,
      questions: [
        {
          text: "¿Música de librería o pista del evento?",
          hint: "si es del evento, basta el enlace",
        },
        { text: "¿Logos juntos en el cierre?", hint: null },
      ],
    },
  );
  assert.equal(
    parseConsultaCommand("CONSULTA BLOQUEA: ¿Fecha?")?.blocking,
    true,
  );
  assert.equal(parseConsultaCommand("Consulta: ¿fecha?"), null);
  assert.equal(parseConsultaCommand("Tengo una CONSULTA"), null);
  assert.deepEqual(parseConsultaCommand("CONSULTA")?.questions, []);
});
