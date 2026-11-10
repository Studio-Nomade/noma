import assert from "node:assert/strict";
import test from "node:test";
import { buildReplyStoryHtml, buildTaskHtmlNotes } from "./asana-content";
import { completeExtraction } from "./extract";
import {
  renderAdjustmentsAckEmail,
  renderApprovedEmail,
  renderCommentAckEmail,
  renderConfirmationEmail,
  renderConsultaEmail,
  renderDeliveryEmail,
  renderEvaluationEmail,
  stageFromEstado,
  type RenderedEmail,
} from "./templates";

const COMMON = {
  folio: "CA-NOV-0042",
  clientName: "Cliente A",
  alias: "cliente-a@studionomade.cl",
  title: "Video resumen evento Marca B",
  requesterName: "Ana Pérez",
  now: new Date("2026-11-09T15:00:00Z"),
  assetsBase: "https://assets.studionomade.cl/noma/email",
};

function assertWellFormed(email: RenderedEmail) {
  assert.ok(email.html.startsWith("<!DOCTYPE html>"));
  assert.doesNotMatch(email.html, /\{\{|\}\}/, "sin variables sin resolver");
  assert.match(email.html, /CA-NOV-0042/);
  assert.match(email.html, /simbolo-nomade-blanco\.png/);
  // Ningún botón abre un correo nuevo fuera del hilo (solo el alias en texto).
  assert.doesNotMatch(email.html, /mailto:[^"]*\?subject/);
  assert.match(email.text, /Design Team · Studio Nomade/);
  assert.doesNotMatch(email.text, /<(table|td|div|span|strong)\b/i);
}

test("01 · confirmación con ficha, estructura, material y pendientes", () => {
  const extraction = completeExtraction({
    title: "Video resumen <Marca B>",
    summary: "Video resumen del evento para LinkedIn.",
    requested_due_date: null,
    priority: "media",
    deliverable_type: "Edición de video resumen",
    requester_first_name: "Ana",
    end_client: "Marca B Group",
    channels: ["LinkedIn"],
    format: "Video",
    structure: {
      title: "Orden de las cuñas",
      items: [
        {
          title: "Persona 1",
          detail: "EVP Sales Latam",
          links: [
            {
              label: "Video parte 1",
              url: "https://drive.google.com/a?x=1&y=2",
              note: "0:12 al 1:00",
            },
          ],
        },
      ],
    },
    considerations: ["Incluir subtítulos."],
    materials: [
      {
        label: "Carpeta de la jornada",
        url: "https://drive.google.com/f",
        kind: "Drive",
      },
    ],
    missing_info: ["Fecha ideal de entrega."],
  });
  const email = renderConfirmationEmail({
    ...COMMON,
    requesterEmail: "ana@cliente-a.cl",
    extraction,
    receivedAt: new Date("2026-11-09T15:06:00Z"),
    attachmentNames: ["visuales.pdf"],
  });
  assertWellFormed(email);
  assert.match(email.html, /Solicitud recibida/);
  assert.match(email.html, /Hola Ana,/);
  assert.match(email.html, /Marca B Group/);
  assert.match(email.html, /LinkedIn · Video/);
  assert.match(email.html, /Orden de las cuñas/);
  assert.match(
    email.html,
    /href="https:\/\/drive\.google\.com\/a\?x=1&amp;y=2"/,
  );
  assert.match(email.html, /Nos falta confirmar/);
  assert.match(email.html, /Lun 09 nov 2026 · 12:06/);
  assert.match(email.html, /bolsa de noviembre/);
  assert.match(email.text, /Fecha ideal de entrega: Por confirmar/);
  assert.match(email.text, /Video parte 1 · 0:12 al 1:00: https:\/\/drive/);
});

test("01 · sin estructura ni pendientes omite esos bloques y escapa HTML", () => {
  const email = renderConfirmationEmail({
    ...COMMON,
    requesterName: null,
    requesterEmail: "x@cliente-a.cl",
    extraction: completeExtraction({
      title: "Post",
      summary: "Post con <script>alert(1)</script>",
      priority: "baja",
    }),
    receivedAt: new Date("2026-11-09T15:06:00Z"),
  });
  assertWellFormed(email);
  assert.doesNotMatch(
    email.html,
    /Nos falta confirmar|Orden de las cuñas|Material/,
  );
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /Normal/);
  assert.match(email.text, /^Hola,/);
});

test("02 · comentario recibido con cambios y pregunta", () => {
  const email = renderCommentAckEmail({
    ...COMMON,
    receivedAt: new Date("2026-11-09T19:20:00Z"),
    stage: 1,
    isQuestion: true,
    points: ["La entrega es para el viernes 13."],
    changes: [{ field: "Prioridad", before: "Media", after: "Alta" }],
  });
  assertWellFormed(email);
  assert.match(email.html, /Comentario recibido/);
  assert.match(email.html, /te respondemos en este hilo/);
  assert.match(email.html, /line-through;">Media/);
  assert.match(email.text, /09 nov a las 16:20/);
});

test("03 · consulta con preguntas numeradas", () => {
  const email = renderConsultaEmail({
    ...COMMON,
    stage: 1,
    questions: [
      { text: "¿Música de librería?", hint: "basta el enlace" },
      { text: "¿Logos?" },
    ],
    blocking: true,
    author: "Diseño",
  });
  assertWellFormed(email);
  assert.match(email.html, /Tenemos una consulta/);
  assert.match(email.html, /La entrega depende de este dato/);
  assert.match(email.text, /02\. ¿Logos\?/);
});

test("04 · entrega 01 y entrega 02 con ajustes aplicados", () => {
  const first = renderDeliveryEmail({
    ...COMMON,
    round: 1,
    files: [
      {
        label: "Video 16:9",
        url: "https://drive.google.com/e1",
        detail: "1:32",
      },
    ],
    note: "Música de librería.",
    author: "Diseño",
  });
  assertWellFormed(first);
  assert.match(first.html, /Entrega 01/);
  assert.match(first.html, /primera versión/);
  assert.match(first.html, /«Aprobado»/);
  assert.doesNotMatch(first.html, /Ajustes aplicados/);

  const second = renderDeliveryEmail({
    ...COMMON,
    round: 2,
    files: [
      { label: "Video 16:9", url: "https://drive.google.com/e2" },
      { label: "Malo", url: "javascript:alert(1)" },
    ],
    appliedAdjustments: ["Cargo corregido."],
  });
  assertWellFormed(second);
  assert.match(second.html, /Ajustes aplicados/);
  assert.match(second.html, /Sobre la Entrega 01/);
  assert.doesNotMatch(second.html, /javascript:/);
});

test("05 · ajustes recibidos y próxima entrega", () => {
  const email = renderAdjustmentsAckEmail({
    ...COMMON,
    reviewedRound: 1,
    adjustments: [
      { text: "Bajar la música.", reference: "0:08–0:56" },
      { text: "Foto al inicio." },
    ],
  });
  assertWellFormed(email);
  assert.match(email.html, /Entrega 02/);
  assert.match(email.text, /Anotamos|vamos a ajustar/);
  assert.match(email.text, /\[0:08–0:56\]/);
});

test("06 · aprobada con cifras y archivos finales", () => {
  const email = renderApprovedEmail({
    ...COMMON,
    finalRound: 2,
    totalRounds: 2,
    receivedAt: new Date("2026-11-09T15:06:00Z"),
    approvedAt: new Date("2026-11-13T20:12:00Z"),
    files: [{ label: "Video final", url: "https://drive.google.com/f" }],
  });
  assertWellFormed(email);
  assert.match(email.html, /Solicitud aprobada/);
  assert.match(email.html, /09 nov/);
  assert.match(email.html, /13 nov/);
  assert.match(email.text, /Gracias Ana/);
});

test("07 · en evaluación sin barra de estado", () => {
  const email = renderEvaluationEmail({
    ...COMMON,
    summary: "Campaña de 3 videos con animación.",
    reasons: ["La animación 2D es producción aparte."],
  });
  assertWellFormed(email);
  assert.match(email.html, /Fuera del plan mensual/);
  assert.doesNotMatch(email.html, />Recibida</);
});

test("barra de estado desde el campo Estado de Asana", () => {
  assert.equal(stageFromEstado("Por revisar"), 0);
  assert.equal(stageFromEstado("En Redacción"), 1);
  assert.equal(stageFromEstado("Con ajustes"), 1);
  assert.equal(stageFromEstado("Enviado a cliente"), 2);
  assert.equal(stageFromEstado("Aprobado"), 3);
  assert.equal(stageFromEstado("Fuera de alcance / En evaluación"), null);
  assert.equal(stageFromEstado(null), null);
});

test("notas de tarea y comentario de respuesta escapan HTML", () => {
  const notes = buildTaskHtmlNotes({
    folio: "EQ-0142",
    extraction: completeExtraction({
      title: "Banner",
      summary: "Banner <b>home</b>",
      details: ["1200x400"],
      requested_due_date: null,
      priority: "alta",
      deliverable_type: null,
      links: ["https://x.cl"],
    }),
    requesterName: "Ana",
    requesterEmail: "ana@cliente.cl",
    ccEmails: [],
    subject: "Banner",
    receivedAt: new Date("2026-10-17T13:00:00Z"),
    alias: "cliente-a@studionomade.cl",
    attachmentNames: ["brief.pdf"],
    scopeLabel: "Dentro del alcance",
    body: "texto <script>",
  });
  assert.ok(notes.startsWith("<body>") && notes.endsWith("</body>"));
  assert.match(notes, /Banner &lt;b&gt;home&lt;\/b&gt;/);
  assert.match(notes, /&lt;script&gt;/);
  assert.match(notes, /<a href="https:\/\/x\.cl">/);

  const story = buildReplyStoryHtml({
    fromName: null,
    fromEmail: "ana@cliente.cl",
    receivedAt: new Date("2026-10-17T13:00:00Z"),
    text: "",
    attachmentNames: [],
  });
  assert.match(story, /Respuesta del cliente por correo/);
  assert.match(story, /sin texto nuevo/);
  assert.doesNotMatch(story, /^\s*<body>\s*ENTREGA/i);
});
