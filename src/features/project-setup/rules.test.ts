import assert from "node:assert/strict";
import test from "node:test";
import {
  areaForTeam,
  clientFolderName,
  decideChannel,
  parseChannelAnswer,
  parseProjectName,
  projectChannelName,
  projectFolderName,
} from "./rules";

test("lee «Cliente | Proyecto»", () => {
  assert.deepEqual(parseProjectName("Cliente A | Estrategia Digital"), {
    client: "Cliente A",
    project: "Estrategia Digital",
  });
  assert.equal(parseProjectName("Proyecto sin cliente"), null);
  assert.equal(parseProjectName("Cliente | "), null);
});

test("encuentra el área por el equipo de Asana", () => {
  assert.equal(areaForTeam("WD | Web Design")?.driveId, "0AG84s5-OMTYHUk9PVA");
  assert.equal(areaForTeam("SN | Operations & Governance"), null);
});

test("nombre del canal: proy-cliente-proyecto", () => {
  assert.equal(
    projectChannelName("Hidrocinco", "Estrategia Digital"),
    "proy-hidrocinco-estrategia_digital",
  );
  assert.equal(
    projectChannelName("Más Que Imagen", "Sitio Web 2027"),
    "proy-mas_que_imagen-sitio_web_2027",
  );
});

test("Slack: usa el canal exacto, crea si no hay del cliente, si no pregunta", () => {
  const channels = [
    { id: "1", name: "general-web-design" },
    { id: "2", name: "proy-hidrocinco-estrategia_digital" },
    { id: "3", name: "proy-architecture-hidrocinco-stand" },
  ];
  assert.deepEqual(
    decideChannel({
      channels,
      client: "Hidrocinco",
      project: "Estrategia Digital",
    }),
    { action: "use", channel: channels[1] },
  );
  assert.deepEqual(
    decideChannel({ channels, client: "Cliente Nuevo", project: "Web" }),
    { action: "create", name: "proy-cliente_nuevo-web" },
  );
  const ask = decideChannel({
    channels,
    client: "Hidrocinco",
    project: "Plataforma",
  });
  assert.equal(ask.action, "ask");
  assert.deepEqual(
    ask.action === "ask" ? ask.candidates.map((c) => c.id) : [],
    ["2", "3"],
  );
});

test("respuesta del equipo: CANAL NUEVO o CANAL #nombre", () => {
  assert.deepEqual(parseChannelAnswer("CANAL NUEVO"), { kind: "new" });
  assert.deepEqual(
    parseChannelAnswer("CANAL #proy-hidrocinco-estrategia_digital"),
    { kind: "existing", name: "proy-hidrocinco-estrategia_digital" },
  );
  assert.equal(parseChannelAnswer("canal nuevo por favor"), null);
});

test("carpetas: CLIENTE y AAAAMMDD_PROYECTO", () => {
  assert.equal(clientFolderName("mm  paisajismo"), "MM PAISAJISMO");
  assert.equal(
    projectFolderName(new Date("2026-11-19T02:00:00Z"), "Sitio web"),
    "20261118_SITIO WEB",
  );
});
