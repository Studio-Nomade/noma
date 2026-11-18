import { strict as assert } from "node:assert";
import { test } from "node:test";
import { resultSchema } from "./result-schema";
import { STAGE_ASANA, asanaTaskName, needsAsanaTask } from "./stages";

test("el resultado acepta roadmap por solicitud, sin roadmap y etapas", () => {
  const r = resultSchema.parse({
    paquete: "PKG-2026-11-18-01",
    roadmap: { codigo: "R76", titulo: "Emergencias", tipo: "mejora" },
    solicitudes: [
      { id: "TE-02", veredicto: "bug", hito: "H1" },
      { id: "BO-05", veredicto: "requiere_desarrollo", roadmap: "NDes-006" },
      { id: "GE-01", veredicto: "requiere_desarrollo", roadmap: null },
    ],
  });
  assert.equal(r.roadmaps.length, 0);
  assert.equal(r.solicitudes[1].roadmap, "NDes-006");
  assert.equal(r.solicitudes[2].roadmap, null);
  assert.equal(r.solicitudes[0].roadmap, undefined);
});

test("después del deploy basta id y estado", () => {
  const r = resultSchema.parse({
    paquete: "PKG-2026-11-18-01",
    solicitudes: [{ id: "TE-02", estado: "en_qa" }],
  });
  assert.equal(r.solicitudes[0].veredicto, undefined);
  assert.equal(r.solicitudes[0].estado, "en_qa");
  assert.throws(() =>
    resultSchema.parse({ solicitudes: [{ id: "TE-02", estado: "listo" }] }),
  );
});

test("nombre de la tarea y cuándo se crea en Asana", () => {
  assert.equal(asanaTaskName("Firma", "R76"), "R76 · Firma");
  assert.equal(asanaTaskName("Rendición", null), "Rendición");
  assert.equal(needsAsanaTask({ verdict: "bug", asanaTaskGid: null }), true);
  assert.equal(
    needsAsanaTask({ verdict: "ya_existe", asanaTaskGid: null }),
    false,
  );
  assert.equal(needsAsanaTask({ verdict: null, asanaTaskGid: null }), false);
  assert.equal(needsAsanaTask({ verdict: "bug", asanaTaskGid: "1" }), false);
  assert.equal(STAGE_ASANA.en_qa.section, "Validación / QA");
  assert.deepEqual(STAGE_ASANA.cerrado.ticketActivo, ["Finalizado"]);
});
