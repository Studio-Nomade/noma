import { strict as assert } from "node:assert";
import { test } from "node:test";
import { renderMinutesEmail } from "./minutes-email";
import { studioMinutesSchema } from "./minutes-format";

const data = studioMinutesSchema.parse({
  resumen: "Revisamos la campaña. Se acordó un nuevo segmento.",
  resumen_breve:
    "Revisamos la campaña Chao Deudas y definimos el plan de diciembre.",
  acuerdos: ["A1", "A2", "A3", "A4", "A5"],
  tareas: [
    {
      tarea: "Enviar la base segmentada",
      responsable: "Equifax",
      fecha: "02-12-2026",
    },
    { tarea: "Diseñar el mailing", responsable: "Studio Nomade", fecha: null },
  ],
  proxima_reunion: "Lunes 7 de diciembre, 11:00",
});

test("correo de minuta: breve, plan de acción y como máximo 4 acuerdos", () => {
  const { html, text } = renderMinutesEmail({
    client: "Equifax",
    title: "B&D - Equifax | Chao Deudas D2C",
    dateLabel: "30-11-2026",
    data,
    signature: "Ana Paula Sanhueza",
    senderEmail: "ana@studionomade.cl",
    greetingNames: ["Manuel", "Pablo"],
    assetsBase: "https://assets.example",
  });
  assert.match(html, /Minuta · Equifax/);
  assert.match(html, /Plan de acción/);
  assert.match(html, /Enviar la base segmentada/);
  assert.match(html, /Hola Manuel y Pablo,/);
  assert.match(html, /PDF adjunto/);
  assert.match(html, /mailto:ana@studionomade\.cl/);
  assert.ok(!html.includes(">A5<"));
  assert.ok(!html.includes("Solicitudes ·"));
  assert.match(text, /01\. Enviar la base segmentada — Equifax · 02-12-2026/);
});
