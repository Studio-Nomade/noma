import assert from "node:assert/strict";
import test from "node:test";
import {
  detectInternalForward,
  forwardedRecipients,
  isForwardSubject,
  parseForwardedMessage,
} from "./forwarded";

const gmailEs = [
  "Te reenvío lo que me mandó la clienta.",
  "",
  "Ana Paula",
  "Directora Creativa",
  "",
  "---------- Forwarded message ---------",
  "De: Paula Soto Hernández <paula@agencia.com>",
  "Date: mié, 11 de nov de 2026, 11:23",
  "Subject: RE: Campaña Interna WhatsApp",
  "To: Catalina <catalina@studionomade.cl>, Jenny Machado <",
  "jenny@cliente.cl>",
  "Cc: Branding Team <branding@studionomade.cl>, Ana <ana@studionomade.cl>",
  "",
  "Hola chicas, ¿cómo están?",
].join("\n");

test("lee el bloque reenviado de Gmail (con destinatarios cortados)", () => {
  const original = parseForwardedMessage(
    gmailEs,
    "Fwd: RE: Campaña Interna WhatsApp",
  );
  assert.ok(original);
  assert.equal(original.from.email, "paula@agencia.com");
  assert.equal(original.from.name, "Paula Soto Hernández");
  assert.equal(original.subject, "RE: Campaña Interna WhatsApp");
  assert.deepEqual(
    original.to.map((a) => a.email),
    ["catalina@studionomade.cl", "jenny@cliente.cl"],
  );
  assert.deepEqual(
    original.cc.map((a) => a.email),
    ["branding@studionomade.cl", "ana@studionomade.cl"],
  );
});

test("lee Outlook en español con mailto y negritas", () => {
  const text = [
    "Javi, te lo paso.",
    "",
    "________________________________",
    "*De:* Pablo Ahumada <mailto:pablo@cliente.cl>",
    "*Enviado:* martes, 10 de noviembre de 2026 9:14",
    "*Para:* Javiera Díaz [mailto:javiera@studionomade.cl]",
    "*Asunto:* Pieza para el evento",
    "",
    "Necesitamos un pendón.",
  ].join("\n");
  const original = parseForwardedMessage(text, "RV: Pieza para el evento");
  assert.ok(original);
  assert.equal(original.from.email, "pablo@cliente.cl");
  assert.equal(original.subject, "Pieza para el evento");
  assert.equal(original.to[0]?.email, "javiera@studionomade.cl");
});

test("lee Outlook en inglés con Original Message y Apple Mail", () => {
  const outlook = parseForwardedMessage(
    "-----Original Message-----\nFrom: Karina <karina@cliente.cl>\nSent: Tuesday\nTo: ana@studionomade.cl\nSubject: Banner\n\nHola",
    "FW: Banner",
  );
  assert.equal(outlook?.from.email, "karina@cliente.cl");

  const apple = parseForwardedMessage(
    "Begin forwarded message:\n\nFrom: Gabriela <gabriela@cliente.cl>\nSubject: Invitación\nDate: 9 de noviembre\nTo: Ana <ana@studionomade.cl>\n\nTexto",
    "Fwd: Invitación",
  );
  assert.equal(apple?.from.email, "gabriela@cliente.cl");
  assert.equal(apple?.subject, "Invitación");
});

test("toma el reenvío más reciente cuando hay varios", () => {
  const text = [
    "---------- Forwarded message ---------",
    "From: Jenny <jenny@cliente.cl>",
    "Date: hoy",
    "Subject: Fwd: Pieza",
    "",
    "---------- Forwarded message ---------",
    "From: Otra <otra@proveedor.cl>",
    "Date: ayer",
    "Subject: Pieza",
  ].join("\n");
  assert.equal(
    parseForwardedMessage(text, "Fwd: Fwd: Pieza")?.from.email,
    "jenny@cliente.cl",
  );
});

test("sin bloque reenviado o sin remitente legible devuelve null", () => {
  assert.equal(
    parseForwardedMessage("Hola, necesito un post.", "Pedido"),
    null,
  );
  assert.equal(
    parseForwardedMessage(
      "---------- Forwarded message ---------\nDate: hoy\n\nHola",
      "Fwd: x",
    ),
    null,
  );
  // Sin marcador ni asunto de reenvío, un "De:" suelto en el texto no cuenta.
  assert.equal(
    parseForwardedMessage(
      "De: Juan <juan@cliente.cl>\nAsunto: algo\n",
      "Consulta",
    ),
    null,
  );
  assert.equal(isForwardSubject("RV: Pieza"), true);
  assert.equal(isForwardSubject("Re: Fwd: Pieza"), true);
  assert.equal(isForwardSubject("Revisión de pieza"), false);
});

test("solo cuenta como reenvío interno si quien reenvía es del estudio y está autenticado", () => {
  const email = {
    from: { name: "Ana", email: "ana@studionomade.cl" },
    text: gmailEs,
    subject: "Fwd: RE: Campaña Interna WhatsApp",
  };
  const forward = detectInternalForward(email, true, "studionomade.cl");
  assert.equal(forward?.by.email, "ana@studionomade.cl");
  assert.equal(forward?.original.from.email, "paula@agencia.com");

  assert.equal(detectInternalForward(email, false, "studionomade.cl"), null);
  assert.equal(
    detectInternalForward(
      { ...email, from: { name: null, email: "x@agencia.com" } },
      true,
      "studionomade.cl",
    ),
    null,
  );
  // Reenvío de un correo interno: no hay cliente detrás.
  assert.equal(
    detectInternalForward(
      {
        ...email,
        text: "---------- Forwarded message ---------\nFrom: Seba <seba@studionomade.cl>\nSubject: x\n\nHola",
      },
      true,
      "studionomade.cl",
    ),
    null,
  );
});

test("la confirmación va al remitente original, con quien reenvió y las copias fijas", () => {
  const forward = detectInternalForward(
    {
      from: { name: "Ana", email: "ana@studionomade.cl" },
      text: gmailEs,
      subject: "Fwd: RE: Campaña Interna WhatsApp",
    },
    true,
    "studionomade.cl",
  );
  assert.ok(forward);
  const recipients = forwardedRecipients(
    forward,
    ["gabriela@cliente.cl", "jenny@cliente.cl"],
    ["operations@studionomade.cl", "equifax@studionomade.cl"],
    10,
  );
  assert.equal(recipients.requester.email, "paula@agencia.com");
  assert.equal(recipients.aliasVisible, true);
  assert.deepEqual(recipients.cc, [
    "gabriela@cliente.cl",
    "jenny@cliente.cl",
    "catalina@studionomade.cl",
    "branding@studionomade.cl",
    "ana@studionomade.cl",
  ]);
});
