import assert from "node:assert/strict";
import test from "node:test";
import { stripQuotedReply } from "./quote-strip";

test("Gmail en español con atribución en dos líneas", () => {
  const body = [
    "Hola, el logo debe ir más grande.",
    "Gracias!",
    "",
    "El lun, 13 oct 2026 a las 10:02, Studio Nomade <",
    "cliente-a@studionomade.cl> escribió:",
    "",
    "> Te enviamos la Entrega 01",
    "> Saludos",
  ].join("\n");
  assert.equal(
    stripQuotedReply(body),
    "Hola, el logo debe ir más grande.\nGracias!",
  );
});

test("Gmail en inglés", () => {
  const body =
    "Looks good, approved.\r\n\r\nOn Mon, Oct 13, 2026 at 10:02 AM Studio <a@b.cl> wrote:\r\n> previous";
  assert.equal(stripQuotedReply(body), "Looks good, approved.");
});

test("bloque de encabezados de Outlook (De/Enviado y From/Sent)", () => {
  const es = [
    "Adjunto la versión final del texto.",
    "",
    "________________________________",
    "De: Studio Nomade <cliente-a@studionomade.cl>",
    "Enviado: lunes, 13 de octubre de 2026 10:02",
    "Para: Ana <ana@cliente.cl>",
    "Asunto: Re: Banner [EQ-0142]",
  ].join("\n");
  assert.equal(stripQuotedReply(es), "Adjunto la versión final del texto.");

  const en = [
    "Please change the color.",
    "",
    "From: Studio Nomade <cliente-a@studionomade.cl>",
    "Sent: Monday, October 13, 2026 10:02 AM",
    "To: Ana",
  ].join("\n");
  assert.equal(stripQuotedReply(en), "Please change the color.");
});

test("Outlook con encabezados en negrita (*De:*)", () => {
  const body = "Ok\n\n*De:* Studio <x@y.cl>\n*Enviado el:* lunes\n*Para:* Ana";
  assert.equal(stripQuotedReply(body), "Ok");
});

test("firma con -- y 'Enviado desde mi iPhone'", () => {
  assert.equal(
    stripQuotedReply("Aprobado.\n\n-- \nAna Pérez\nGerente de Marketing"),
    "Aprobado.",
  );
  assert.equal(
    stripQuotedReply(
      "Aprobado.\n\nEnviado desde mi iPhone\n\nEl lun ... escribió:",
    ),
    "Aprobado.",
  );
});

test("elimina citas intercaladas con >", () => {
  const body =
    "> ¿El banner va en home?\nSí, en home.\n> ¿Y el tamaño?\n1200x400";
  assert.equal(stripQuotedReply(body), "Sí, en home.\n1200x400");
});

test("no corta frases que empiezan con 'El' sin atribución", () => {
  const body = "El banner quedó muy bien.\nEl color está perfecto.";
  assert.equal(stripQuotedReply(body), body);
});

test("mensaje solo citado devuelve vacío", () => {
  assert.equal(stripQuotedReply("> solo cita\n> nada nuevo"), "");
});
