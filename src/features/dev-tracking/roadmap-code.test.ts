import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  compareRoadmapCodes,
  detectMilestone,
  detectRoadmapCode,
  isPromotion,
} from "./roadmap-code";

test("detecta el código en títulos de PR", () => {
  assert.equal(detectRoadmapCode("[R74] H2 devueltas a Operaciones"), "R74");
  assert.equal(detectRoadmapCode("NDes-006 etapa 1 (APK): placa"), "NDes-006");
  assert.equal(detectRoadmapCode("ndes-002 telemetría"), "NDes-002");
  assert.equal(detectRoadmapCode("OT-05: fecha límite"), null);
});

test("detecta el código y el hito en nombres de rama", () => {
  assert.equal(detectRoadmapCode("feat/r74-h2-devueltas-operaciones"), "R74");
  assert.equal(detectMilestone("feat/r74-h2-devueltas-operaciones"), "H2");
  assert.equal(detectMilestone("NDes-006 H0.3 criterios"), "H0.3");
});

test("reconoce promociones a main", () => {
  assert.equal(isPromotion("main", "promote/2026-11-17-r74", "x"), true);
  assert.equal(isPromotion("main", null, "Promoción: R74 H5 estanques"), true);
  assert.equal(isPromotion("main", "feat/x", "NDes-006 etapa 1 (APK)"), false);
  assert.equal(isPromotion("develop", "promote/x", "Promoción"), false);
});

test("ordena NDes antes que R y por número", () => {
  const codes = ["R74", "NDes-002", "R16", "NDes-001"].sort(
    compareRoadmapCodes,
  );
  assert.deepEqual(codes, ["NDes-001", "NDes-002", "R16", "R74"]);
});
