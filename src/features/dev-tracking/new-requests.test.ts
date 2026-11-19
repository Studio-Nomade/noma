import { strict as assert } from "node:assert";
import { test } from "node:test";
import { boardArea, newRequestValues, originLine } from "./new-requests";
import { resultSchema } from "./result-schema";

const body = {
  roadmap: { codigo: "R90", estado: "en_prod" },
  solicitudes_nuevas: [
    {
      id: "R90-S1",
      origen: "whatsapp",
      fecha: "2026-11-19",
      solicitante: "Persona Uno",
      area: "Bodega",
      titulo: "El listado no mostraba un tipo de documento",
      veredicto: "bug",
      hito: "S1",
      estado: "cerrado",
    },
    {
      id: "R90-S2",
      area: "Operaciones",
      titulo: "Ver el procedimiento en la ficha",
      veredicto: "ya_existe",
      nota: "Ya está; se ajustó el texto",
      estado: "cerrado",
    },
  ],
};

test("solicitudes_nuevas: schema con valores por defecto", () => {
  const r = resultSchema.parse(body);
  assert.equal(r.solicitudes_nuevas.length, 2);
  assert.equal(r.solicitudes_nuevas[1].origen, "whatsapp");
  assert.equal(r.solicitudes.length, 0);
  assert.throws(() =>
    resultSchema.parse({
      solicitudes_nuevas: [{ id: "X-1", titulo: "Sin veredicto" }],
    }),
  );
  assert.throws(() =>
    resultSchema.parse({
      solicitudes_nuevas: [
        {
          id: "X-1",
          titulo: "Etapa inválida",
          veredicto: "bug",
          estado: "listo",
        },
      ],
    }),
  );
});

test("área del tablero", () => {
  assert.equal(boardArea("Bodega"), "Comerciales");
  assert.equal(boardArea("Comercial"), "Comerciales");
  assert.equal(boardArea("Operaciones"), "Técnicos");
  assert.equal(boardArea("técnicos"), "Técnicos");
  assert.equal(boardArea("Telemetría"), "IoT/Telemetría");
  assert.equal(boardArea("Gerencia"), "Gerencia");
  assert.equal(boardArea(undefined), null);
});

test("fila del backlog para una solicitud nueva", () => {
  const [s1, s2] = resultSchema.parse(body).solicitudes_nuevas;
  const v1 = newRequestValues(s1, "R90");
  assert.equal(v1.code, "R90-S1");
  assert.equal(v1.status, "verificada");
  assert.equal(v1.verdict, "bug");
  assert.equal(v1.type, "Bug / error");
  assert.equal(v1.area, "Comerciales");
  assert.equal(v1.roadmapCode, "R90");
  assert.equal(v1.destination, "roadmap_en_curso");
  assert.equal(v1.stage, "cerrado");
  assert.equal(v1.raisedBy, "Persona Uno");
  assert.equal(v1.evidence, "WhatsApp · 19-11-2026");
  // «ya existe» no queda en el roadmap ni genera tarea.
  const v2 = newRequestValues(s2, "R90");
  assert.equal(v2.roadmapCode, null);
  assert.equal(v2.type, null);
  assert.equal(v2.verdictNote, "Ya está; se ajustó el texto");
  assert.equal(originLine({ origen: "correo" }), "Correo");
});
