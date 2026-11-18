import { strict as assert } from "node:assert";
import { test } from "node:test";
import { renderMinutesEmail } from "./minutes-email";
import { minutesOutputSchema, minutesUserPrompt } from "./minutes-schema";

const sample = minutesOutputSchema.parse({
  resumen: "Se revisó el avance del módulo de ensayo.",
  acuerdos: ["El cliente envía el archivo de pruebas el viernes."],
  decisiones_pendientes: [],
  confirmado_sin_desarrollo: ["La periodicidad ya se puede desactivar."],
  cifras_dichas: [{ texto: "~10.000 órdenes", contexto: "total histórico" }],
  solicitudes: [
    {
      prefijo: "OP",
      titulo: "Avisar cuando falte material",
      detalle: "Marcar la orden como <en espera> cuando falte material.",
      area: "Comerciales",
      tipo: "Nuevo desarrollo",
      entorno: "Web",
      prioridad_sugerida: "Alta",
      destino_sugerido: "roadmap_en_curso",
      roadmap_o_modulo: "R74",
    },
  ],
  preguntas_abiertas: [
    { pregunta: "¿Quién marca que llegó el material?", para: "Comercial" },
  ],
});

test("el correo de minuta escapa HTML y lleva códigos y cifras como dichas", () => {
  const { html, text } = renderMinutesEmail({
    meetingTitle: "Revisión semanal",
    meetingDate: "martes 24 de noviembre, 09:00",
    programName: "Programa",
    data: sample,
    codes: ["OP-01"],
  });
  assert.ok(html.includes("OP-01 · Avisar cuando falte material (Alta)"));
  assert.ok(
    html.includes("&lt;en espera&gt;") === false,
    "el detalle no va en el correo",
  );
  assert.ok(html.includes("dicho en la reunión, por verificar"));
  assert.ok(!/\bPR\b|merge|deploy/i.test(text));
  assert.ok(text.includes("¿Quién marca que llegó el material? — Comercial"));
});

test("el prompt lleva módulos en curso y la transcripción", () => {
  const prompt = minutesUserPrompt({
    meetingTitle: "Revisión",
    meetingDate: "hoy",
    programName: "P",
    clientName: "C",
    attendees: [{ name: "Ana", email: "ana@example.com" }],
    modules: [{ code: "NDes-006", name: "Banco", ballOwner: "Rodrigo" }],
    transcript: "hola",
  });
  assert.ok(prompt.includes("- NDes-006 · Banco (pelota en Rodrigo)"));
  assert.ok(prompt.includes("Ana <ana@example.com>"));
  assert.ok(prompt.endsWith("hola"));
});
