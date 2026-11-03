import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMimeMessage,
  buildReplyThreadHeaders,
  decodeMimeWords,
  encodeBase64Url,
  encodeHeaderValue,
  htmlToText,
  isAutomatedMessage,
  parseGmailMessage,
  stripHtmlQuote,
  type GmailMessage,
} from "./mime";

function headerBlock(raw: string) {
  return raw.split("\r\n\r\n")[0];
}

test("arma una respuesta en el mismo hilo con encabezados RFC 2822", () => {
  const thread = buildReplyThreadHeaders({
    parentMessageId: "<last@cliente.cl>",
    references: [
      "<orig@cliente.cl>",
      "<orig@cliente.cl> <noma.1@studionomade.cl>",
    ],
  });
  assert.deepEqual(thread, {
    inReplyTo: "<last@cliente.cl>",
    references: [
      "<orig@cliente.cl>",
      "<noma.1@studionomade.cl>",
      "<last@cliente.cl>",
    ],
  });

  const raw = buildMimeMessage(
    {
      from: { name: "Studio Nomade", email: "cliente-a@studionomade.cl" },
      to: ["ana@cliente.cl"],
      cc: ["jefa@cliente.cl"],
      replyTo: "cliente-a@studionomade.cl",
      subject: "Re: Banner campaña [EQ-0142]",
      text: "Hola Ana",
      html: "<p>Hola Ana</p>",
      inReplyTo: thread.inReplyTo,
      references: thread.references,
      messageId: "<noma.2@studionomade.cl>",
      date: new Date("2026-10-17T13:00:00Z"),
    },
    "BOUNDARY",
  );
  const headers = headerBlock(raw);
  assert.match(
    headers,
    /^From: "Studio Nomade" <cliente-a@studionomade\.cl>$/m,
  );
  assert.match(headers, /^To: ana@cliente\.cl$/m);
  assert.match(headers, /^Cc: jefa@cliente\.cl$/m);
  assert.match(headers, /^Reply-To: cliente-a@studionomade\.cl$/m);
  assert.match(headers, /^In-Reply-To: <last@cliente\.cl>$/m);
  assert.match(
    headers,
    /^References: <orig@cliente\.cl>\r\n <noma\.1@studionomade\.cl>\r\n <last@cliente\.cl>$/m,
  );
  assert.match(headers, /^Message-ID: <noma\.2@studionomade\.cl>$/m);
  assert.match(headers, /^Date: Sat, 17 Oct 2026 13:00:00 \+0000$/m);
  assert.match(
    headers,
    /^Content-Type: multipart\/alternative; boundary="BOUNDARY"$/m,
  );
  // Asunto no ASCII → encoded-word que vuelve al original.
  const subjectLine = headers.match(/^Subject: ([\s\S]+?)\r\n(?=[A-Z])/m)?.[1];
  assert.ok(subjectLine?.startsWith("=?UTF-8?B?"));
  assert.equal(
    decodeMimeWords(subjectLine!.replace(/\r\n /g, " ")),
    "Re: Banner campaña [EQ-0142]",
  );
  // Cuerpo con texto y HTML en base64.
  assert.ok(raw.includes(Buffer.from("Hola Ana").toString("base64")));
  assert.ok(raw.includes(Buffer.from("<p>Hola Ana</p>").toString("base64")));
  assert.ok(raw.trimEnd().endsWith("--BOUNDARY--"));
});

test("sin mensaje padre no agrega In-Reply-To ni References", () => {
  const raw = buildMimeMessage({
    from: { name: null, email: "a@studionomade.cl" },
    to: ["b@cliente.cl"],
    subject: "Hola",
    text: "x",
    html: "<p>x</p>",
  });
  const headers = headerBlock(raw);
  assert.doesNotMatch(headers, /In-Reply-To|References|Cc:/);
  assert.match(headers, /^Subject: Hola$/m);
});

test("encoded-words largos se parten en trozos ≤ 75 caracteres", () => {
  const encoded = encodeHeaderValue("Ñ".repeat(80));
  for (const word of encoded.split("\r\n ")) {
    assert.ok(word.length <= 75, word);
  }
  assert.equal(decodeMimeWords(encoded.replace(/\r\n /g, " ")), "Ñ".repeat(80));
});

test("decodifica encoded-words Q y B", () => {
  assert.equal(
    decodeMimeWords("=?ISO-8859-1?Q?Mar=EDa_P=E9rez?="),
    "María Pérez",
  );
  assert.equal(
    decodeMimeWords("=?UTF-8?B?w5Fhbg==?= =?UTF-8?B?ZMO6?="),
    "Ñandú",
  );
});

test("parsea un mensaje de la Gmail API (format=full)", () => {
  const message: GmailMessage = {
    id: "18f0",
    threadId: "18e9",
    labelIds: ["INBOX", "UNREAD"],
    historyId: "999",
    internalDate: "1792242000000",
    payload: {
      mimeType: "multipart/mixed",
      headers: [
        { name: "From", value: "=?UTF-8?Q?Ana_P=C3=A9rez?= <Ana@Cliente.cl>" },
        { name: "To", value: "cliente-a@studionomade.cl" },
        {
          name: "Cc",
          value: "Jefa <jefa@cliente.cl>, persona@studionomade.cl",
        },
        { name: "Subject", value: "=?UTF-8?B?QmFubmVyIGNhbXBhw7Fh?=" },
        { name: "Message-ID", value: "<orig@cliente.cl>" },
        { name: "In-Reply-To", value: "<prev@cliente.cl>" },
        { name: "References", value: "<a@x> <prev@cliente.cl>" },
        { name: "Date", value: "Sat, 17 Oct 2026 10:00:00 -0300" },
      ],
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            {
              mimeType: "text/plain",
              headers: [
                { name: "Content-Type", value: 'text/plain; charset="UTF-8"' },
              ],
              body: { data: encodeBase64Url("Necesito un banner 1200x400") },
            },
            {
              mimeType: "text/html",
              body: { data: encodeBase64Url("<p>Necesito un banner</p>") },
            },
          ],
        },
        {
          mimeType: "application/pdf",
          filename: "brief.pdf",
          headers: [
            {
              name: "Content-Disposition",
              value: 'attachment; filename="brief.pdf"',
            },
          ],
          body: { size: 2048, attachmentId: "att-1" },
        },
      ],
    },
  };
  const parsed = parseGmailMessage(message);
  assert.equal(parsed.subject, "Banner campaña");
  assert.deepEqual(parsed.from, { name: "Ana Pérez", email: "ana@cliente.cl" });
  assert.deepEqual(
    parsed.cc.map((a) => a.email),
    ["jefa@cliente.cl", "persona@studionomade.cl"],
  );
  assert.equal(parsed.messageId, "<orig@cliente.cl>");
  assert.equal(parsed.inReplyTo, "<prev@cliente.cl>");
  assert.deepEqual(parsed.references, ["<a@x>", "<prev@cliente.cl>"]);
  assert.equal(parsed.text, "Necesito un banner 1200x400");
  assert.equal(parsed.html, "<p>Necesito un banner</p>");
  assert.equal(parsed.date.toISOString(), "2026-10-17T13:00:00.000Z");
  assert.deepEqual(parsed.attachments, [
    {
      filename: "brief.pdf",
      mimeType: "application/pdf",
      size: 2048,
      attachmentId: "att-1",
      inlineData: null,
      contentId: null,
      inline: false,
    },
  ]);
});

test("decodifica cuerpos latin1 y usa HTML si no hay texto plano", () => {
  const parsed = parseGmailMessage({
    id: "1",
    threadId: "1",
    payload: {
      mimeType: "text/html",
      headers: [
        { name: "Content-Type", value: "text/html; charset=iso-8859-1" },
        { name: "Subject", value: "Hola" },
      ],
      body: {
        data: encodeBase64Url(
          Buffer.from("<p>Dise\xf1o &amp; m\xe1s</p><br>l\xednea", "latin1"),
        ),
      },
    },
  });
  assert.equal(parsed.text, "Diseño & más\n\nlínea");
});

test("corta la cita HTML de Gmail y Outlook", () => {
  assert.equal(
    htmlToText(
      stripHtmlQuote(
        '<div>Ok, aprobado</div><div class="gmail_quote"><div>El lun escribió:</div><blockquote>viejo</blockquote></div>',
      ),
    ),
    "Ok, aprobado",
  );
  assert.equal(
    htmlToText(
      stripHtmlQuote('<p>Cambiar color</p><div id="divRplyFwdMsg">De: x</div>'),
    ),
    "Cambiar color",
  );
});

test("detecta respuestas automáticas", () => {
  assert.equal(
    isAutomatedMessage({ "auto-submitted": ["auto-replied"] }),
    true,
  );
  assert.equal(isAutomatedMessage({ "auto-submitted": ["no"] }), false);
  assert.equal(isAutomatedMessage({ precedence: ["bulk"] }), true);
  assert.equal(isAutomatedMessage({ "x-autoreply": ["yes"] }), true);
  assert.equal(
    isAutomatedMessage({
      "content-type": ["multipart/report; report-type=delivery-status"],
    }),
    true,
  );
  assert.equal(isAutomatedMessage({ subject: ["Hola"] }), false);
});

test("From con encoded-word no puede inyectar otra dirección", () => {
  const injected = Buffer.from("boss@client.cl,").toString("base64");
  const parsed = parseGmailMessage({
    id: "2",
    threadId: "2",
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: `=?UTF-8?B?${injected}?= <attacker@evil.com>` },
        {
          name: "Reply-To",
          value: '"Jefe <jefe@client.cl>" <otro@evil.com>',
        },
        { name: "To", value: "=?UTF-8?Q?P=C3=A9rez?= <ana@client.cl>" },
      ],
      body: { data: encodeBase64Url(Buffer.from("hola")) },
    },
  });
  assert.equal(parsed.from?.email, "attacker@evil.com");
  assert.equal(parsed.from?.name, "boss@client.cl,");
  assert.equal(parsed.replyTo[0]?.email, "otro@evil.com");
  assert.deepEqual(parsed.to, [{ name: "Pérez", email: "ana@client.cl" }]);
});
