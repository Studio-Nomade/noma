import assert from "node:assert/strict";
import test from "node:test";
import {
  commentCommandActive,
  parseCommentCommand,
  parseClientRelayCommand,
  parseConsultaCommand,
  parseDeliveryCommand,
} from "./delivery-command";

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
    attachments: [],
    note: "Se ajustó el color del CTA.\nQuedamos atentos",
  });
});

test("entrega sin nota", () => {
  assert.deepEqual(parseDeliveryCommand("ENTREGA 1 - https://x.cl/a"), {
    round: 1,
    links: ["https://x.cl/a"],
    files: [{ label: "Archivo 01", url: "https://x.cl/a", detail: null }],
    attachments: [],
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

test("Consulta en minúsculas: sola en la primera línea y con preguntas", () => {
  assert.deepEqual(
    parseConsultaCommand("Consulta\n¿Cuál versión es la aprobada?"),
    {
      blocking: false,
      questions: [{ text: "¿Cuál versión es la aprobada?", hint: null }],
    },
  );
  assert.equal(
    parseConsultaCommand("consulta bloquea:\n¿Fecha del evento?")?.blocking,
    true,
  );
  // Sin preguntas debajo, o con texto en la misma línea, es conversación interna.
  assert.equal(parseConsultaCommand("Consulta"), null);
  assert.equal(
    parseConsultaCommand("Consulta: ¿lo vemos mañana?\nGracias"),
    null,
  );
  assert.equal(
    parseConsultaCommand("consulta para el equipo\n¿quién lo toma?"),
    null,
  );
});

test("CLIENTE registra el mensaje y el canal", () => {
  assert.deepEqual(
    parseClientRelayCommand("CLIENTE: el logo no debe decir Viña del Mar"),
    { via: "WhatsApp", text: "el logo no debe decir Viña del Mar" },
  );
  assert.deepEqual(
    parseClientRelayCommand("CLIENTE (llamada)\nQue el video sea en MP4"),
    { via: "Llamada", text: "Que el video sea en MP4" },
  );
  assert.deepEqual(
    parseClientRelayCommand('CLIENTE: "Hola! súbanlo en video"'),
    { via: "WhatsApp", text: "Hola! súbanlo en video" },
  );
});

test("CLIENTE sin mensaje o en minúsculas no cuenta", () => {
  assert.equal(parseClientRelayCommand("CLIENTE:"), null);
  assert.equal(parseClientRelayCommand("cliente: dice que ok"), null);
  assert.equal(parseClientRelayCommand("CLIENTES felices"), null);
  assert.equal(parseClientRelayCommand("ENTREGA 01"), null);
});

test("COMENTARIO: primera palabra + «:» o salto de línea", () => {
  const plain = parseCommentCommand(
    "Comentario\nLos archivos están arriba nuevamente, con el logo corregido.",
  );
  assert.deepEqual(plain, {
    text: "Los archivos están arriba nuevamente, con el logo corregido.",
    links: [],
    files: [],
    attachments: [],
  });
  assert.equal(
    parseCommentCommand("COMENTARIO: actualizamos la ficha.")?.text,
    "actualizamos la ficha.",
  );
  assert.equal(parseCommentCommand("comentario:\nok")?.text, "ok");
  // La palabra en medio del texto, o sin «:»/salto, no dispara nada.
  assert.equal(parseCommentCommand("Un comentario interno"), null);
  assert.equal(parseCommentCommand("Comentario interno para Cata"), null);
  assert.equal(parseCommentCommand("Comentarios: varios"), null);
  assert.equal(parseCommentCommand(null), null);
});

test("COMENTARIO: links como archivos y sin «ENVIAR AHORA»", () => {
  const command = parseCommentCommand(
    "Comentario\nVolvimos a subir la pieza.\nPieza final (PDF): https://drive.google.com/file/d/abc/view\nENVIAR AHORA",
  );
  assert.equal(command?.text, "Volvimos a subir la pieza.");
  assert.deepEqual(command?.files, [
    {
      url: "https://drive.google.com/file/d/abc/view",
      label: "Pieza final",
      detail: "PDF",
    },
  ]);
  // Sin texto ni links: el parser lo reconoce y el envío lo rechaza.
  assert.deepEqual(parseCommentCommand("Comentario:"), {
    text: null,
    links: [],
    files: [],
    attachments: [],
  });
});

test("COMENTARIO: solo desde la fecha de corte", () => {
  const since = "2026-11-21T03:00:00.000Z";
  assert.equal(commentCommandActive("2026-11-21T12:00:00.000Z", since), true);
  assert.equal(commentCommandActive("2026-11-20T12:00:00.000Z", since), false);
  assert.equal(commentCommandActive(null, since), false);
  assert.equal(commentCommandActive("2026-11-20T12:00:00.000Z", ""), true);
});

test("ENTREGA con «Adjunto:» (archivo adjunto a la tarea, sin link)", () => {
  const parsed = parseDeliveryCommand(
    "ENTREGA 01\nAdjunto: 20261127_Decision_Summit_Cooperativas.zip\nVista previa: https://drive.google.com/a\nLos HTML van en el zip.",
  );
  assert.deepEqual(parsed?.attachments, [
    "20261127_Decision_Summit_Cooperativas.zip",
  ]);
  assert.equal(parsed?.files.length, 1);
  assert.equal(parsed?.note, "Los HTML van en el zip.");
  // Solo adjunto, en minúsculas: también es entrega.
  const loose = parseDeliveryCommand("Entrega 02\nAdjuntos: «correos.zip»");
  assert.equal(loose?.round, 2);
  assert.deepEqual(loose?.attachments, ["correos.zip"]);
  assert.deepEqual(loose?.links, []);
  // Sin link ni adjunto, «entrega 2» en minúsculas sigue siendo conversación.
  assert.equal(parseDeliveryCommand("entrega 2\nla vemos mañana"), null);
});

test("COMENTARIO con «Adjunto:»", () => {
  const parsed = parseCommentCommand(
    "Comentario\nVa el zip actualizado.\nAdjunto: correos-v2.zip",
  );
  assert.deepEqual(parsed?.attachments, ["correos-v2.zip"]);
  assert.equal(parsed?.text, "Va el zip actualizado.");
});
