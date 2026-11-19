import assert from "node:assert/strict";
import test from "node:test";
import {
  backlogView,
  defaultDevAssignee,
  stageCompletesTask,
  stageSection,
} from "./stages";

test("las cerradas van a «<Mes> (cerradas)» del mes en curso (Santiago)", () => {
  assert.equal(
    stageSection("cerrado", new Date("2026-11-19T01:00:00Z")),
    "Noviembre (cerradas)",
  );
  // 01-12 00:30 en Santiago (UTC-3) → diciembre; 30-11 23:30 → noviembre.
  assert.equal(
    stageSection("cerrado", new Date("2026-12-01T03:30:00Z")),
    "Diciembre (cerradas)",
  );
  assert.equal(
    stageSection("cerrado", new Date("2026-12-01T02:30:00Z")),
    "Noviembre (cerradas)",
  );
  assert.equal(stageSection("en_qa"), "Validación / QA");
});

test("solo «cerrado» completa la tarea", () => {
  assert.equal(stageCompletesTask("cerrado"), true);
  assert.equal(stageCompletesTask("en_qa"), false);
});

test("responsable por defecto: Sebastián salvo configuración", () => {
  assert.equal(defaultDevAssignee({}), "sebastian@studionomade.cl");
  assert.equal(
    defaultDevAssignee({ DEV_TRACKING_ASANA_ASSIGNEE: "123" }),
    "123",
  );
});

test("vista del backlog: las cerradas salen de «Revisada» a «Completadas»", () => {
  assert.equal(
    backlogView({ status: "verificada", stage: "cerrado" }),
    "completada",
  );
  assert.equal(
    backlogView({ status: "en_asana", stage: "cerrado" }),
    "completada",
  );
  assert.equal(
    backlogView({ status: "verificada", stage: "priorizado" }),
    "verificada",
  );
  assert.equal(
    backlogView({ status: "descartada", stage: "cerrado" }),
    "descartada",
  );
});
