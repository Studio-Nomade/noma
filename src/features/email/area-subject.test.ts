import assert from "node:assert/strict";
import test from "node:test";
import {
  areaClientAndRequest,
  areaDeliverySubject,
  areaReplySubject,
  areaSubjectBase,
  normalizeThreadSubject,
} from "./area-subject";

test("modelo B: cliente y solicitud desde el campo Cliente y el nombre", () => {
  assert.deepEqual(
    areaClientAndRequest("DISEÑO IDENTIDAD PINGÜINO", "Pinguino"),
    { client: "Pinguino", request: "Diseño identidad" },
  );
  assert.deepEqual(
    areaClientAndRequest("CERRO AZUL | Diseño Elementos", null),
    { client: "Cerro Azul", request: "Diseño Elementos" },
  );
  assert.deepEqual(
    areaClientAndRequest(
      "Panadería Sol | Desarrollo de Identidad",
      "Panadería Sol",
    ),
    { client: "Panadería Sol", request: "Desarrollo de Identidad" },
  );
  assert.deepEqual(areaClientAndRequest("Presentaciones Bata", null), {
    client: null,
    request: "Presentaciones Bata",
  });
  assert.deepEqual(areaClientAndRequest("[X-1] ACME | AJUSTES", null), {
    client: "Acme",
    request: "Ajustes",
  });
});

test("modelo B: asunto con la nomenclatura del área", () => {
  const base = areaSubjectBase("CE", "Pinguino", "Diseño identidad");
  assert.equal(base, "CE - Pinguino | Diseño identidad");
  assert.equal(areaSubjectBase("WD", null, "Sitio"), "WD - Sitio");
  assert.equal(
    areaDeliverySubject(base, 2),
    "CE - Pinguino | Diseño identidad - Entrega 02",
  );
  assert.equal(areaReplySubject("Re: X - Entrega 01"), "Re: X - Entrega 01");
  assert.equal(areaReplySubject("X - Entrega 01"), "Re: X - Entrega 01");
  assert.equal(
    normalizeThreadSubject("RE: Fwd:  X - Entrega 01"),
    "x - entrega 01",
  );
});
