import assert from "node:assert/strict";
import test from "node:test";
import { buildReplyStoryHtml, buildTaskHtmlNotes } from "./asana-content";
import { renderConfirmationEmail, renderDeliveryEmail } from "./templates";

test("confirmación con folio, título, fecha y llamado a responder", () => {
  const email = renderConfirmationEmail({
    folio: "EQ-0142",
    title: "Banner <Cyber>",
    requesterName: "Ana Pérez",
    dueDate: "2026-10-19",
  });
  assert.match(email.text, /^Hola Ana:/);
  assert.match(
    email.text,
    /Recibimos tu solicitud \[EQ-0142\] · Banner <Cyber>\./,
  );
  assert.match(email.text, /Fecha estimada: lunes 19 de octubre de 2026\./);
  assert.match(email.text, /Responde a este correo/);
  assert.match(email.html, /\[EQ-0142\]<\/strong> · Banner &lt;Cyber&gt;/);
  assert.doesNotMatch(email.html, /<img|https?:\/\/[^"]*\.(png|jpg)/);
});

test("confirmación sin fecha ni nombre", () => {
  const email = renderConfirmationEmail({ folio: "H5-0001", title: "Post" });
  assert.match(email.text, /^Hola:/);
  assert.match(email.text, /por confirmar con el equipo/);
});

test("entrega con número de ronda, links y comentarios", () => {
  const email = renderDeliveryEmail({
    folio: "EQ-0142",
    round: 1,
    title: "Banner Cyber",
    links: ["https://drive.google.com/x?a=1&b=2"],
    note: "Se ajustó el CTA.",
    requesterName: "Ana",
  });
  assert.match(email.text, /Entrega 01 de tu solicitud \[EQ-0142\]/);
  assert.match(email.text, /- https:\/\/drive\.google\.com\/x\?a=1&b=2/);
  assert.match(email.text, /Comentarios del equipo:\nSe ajustó el CTA\./);
  assert.match(email.text, /responde en este mismo hilo/i);
  assert.match(
    email.html,
    /href="https:\/\/drive\.google\.com\/x\?a=1&amp;b=2"/,
  );
});

test("notas de tarea y comentario de respuesta escapan HTML", () => {
  const notes = buildTaskHtmlNotes({
    folio: "EQ-0142",
    extraction: {
      title: "Banner",
      summary: "Banner <b>home</b>",
      details: ["1200x400"],
      requested_due_date: null,
      priority: "alta",
      deliverable_type: null,
      links: ["https://x.cl"],
    },
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
