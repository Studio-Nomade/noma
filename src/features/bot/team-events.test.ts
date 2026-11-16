import assert from "node:assert/strict";
import test from "node:test";
import {
  adjustmentsMessage,
  deliverySentMessage,
  parseSlackUserIds,
  requestClosedMessage,
  slackMention,
} from "./team-events";

const ids = parseSlackUserIds(
  "ana@estudio.cl=U03AAAAAAA1, Javi@Estudio.cl:u07bbbbbbb2\nmalo=UX, x@y.cl=nope",
);
const url = "https://app.asana.com/0/1/2";

test("lee el mapa correo → usuario de Slack e ignora entradas inválidas", () => {
  assert.equal(ids.size, 2);
  assert.equal(ids.get("ana@estudio.cl"), "U03AAAAAAA1");
  assert.equal(ids.get("javi@estudio.cl"), "U07BBBBBBB2");
  assert.equal(parseSlackUserIds(undefined).size, 0);
});

test("etiqueta al usuario de Slack; sin ID usa el nombre", () => {
  assert.equal(
    slackMention({ email: "JAVI@estudio.cl", name: "Javiera" }, ids),
    "<@U07BBBBBBB2>",
  );
  assert.equal(
    slackMention({ email: "otra@estudio.cl", name: "Cata <x>" }, ids),
    "*Cata x*",
  );
  assert.equal(slackMention(null, ids), null);
});

test("entrega enviada: corto y con link", () => {
  const msg = deliverySentMessage({
    folio: "EQX-NOV-0001",
    clientName: "Cliente A",
    round: 2,
    asanaUrl: url,
  });
  assert.equal(
    msg.body,
    `📦 \`EQX-NOV-0001\` · Cliente A · *Entrega 02 enviada* al cliente. <${url}|Abrir en Asana>`,
  );
  assert.match(msg.text, /Entrega 02 enviada · EQX-NOV-0001/);
});

test("ajustes: no repite los cambios y etiqueta al responsable", () => {
  const msg = adjustmentsMessage({
    folio: "EQX-NOV-0001",
    clientName: "Cliente A",
    round: 1,
    asanaUrl: url,
    assignee: "<@U07BBBBBBB2>",
  });
  assert.equal(
    msg.body,
    `🔁 \`EQX-NOV-0001\` · Cliente A · El cliente pidió *ajustes a la Entrega 01*. <@U07BBBBBBB2>, quedaron en la tarea. <${url}|Abrir en Asana>`,
  );
  const orphan = adjustmentsMessage({
    clientName: "Cliente A",
    assignee: null,
    asanaUrl: "javascript:alert(1)",
  });
  assert.match(orphan.body, /sin responsable/);
  assert.doesNotMatch(orphan.body, /Abrir en Asana/);
});

test("cierre: por el cliente o por el equipo", () => {
  assert.match(
    requestClosedMessage({ clientName: "Cliente A", by: "client" }).body,
    /Aprobada por el cliente\* y cerrada\.$/,
  );
  assert.match(
    requestClosedMessage({
      folio: "G-1",
      clientName: "Cliente A",
      by: "team",
      closedBy: "Javiera Díaz",
      asanaUrl: url,
    }).body,
    /^✅ `G-1` · Cliente A · \*Cerrada\* por Javiera Díaz\. </,
  );
});
