import assert from "node:assert/strict";
import test from "node:test";
import { isLifecycleStory, shouldPlanOnAssign } from "./lifecycle-rules";

test("al asignar, solo pasa a Planificada desde Por revisar o sin Estado", () => {
  assert.equal(shouldPlanOnAssign(null), true);
  assert.equal(shouldPlanOnAssign(""), true);
  assert.equal(shouldPlanOnAssign("Por revisar"), true);
  assert.equal(shouldPlanOnAssign("por REVISAR"), true);
  assert.equal(shouldPlanOnAssign("Planificada"), false);
  assert.equal(shouldPlanOnAssign("En diseño"), false);
  assert.equal(shouldPlanOnAssign("Con ajustes"), false);
});

test("reconoce asignaciones y cierres", () => {
  assert.equal(isLifecycleStory({ resource_subtype: "assigned" }), true);
  assert.equal(isLifecycleStory({ resource_subtype: "marked_complete" }), true);
  assert.equal(isLifecycleStory({ resource_subtype: "unassigned" }), false);
  assert.equal(isLifecycleStory({ resource_subtype: "comment_added" }), false);
  assert.equal(isLifecycleStory({ resource_subtype: null }), false);
});
