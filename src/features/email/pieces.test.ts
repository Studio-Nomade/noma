import assert from "node:assert/strict";
import test from "node:test";
import { pieceLabel, planPieceApproval } from "./pieces";

const subtasks = [
  { gid: "a", name: "Invitación", completed: false },
  { gid: "b", name: "Agenda", completed: true },
  { gid: "c", name: "Presentación", completed: false },
];

test("sin piezas, la aprobación cierra la solicitud", () => {
  const plan = planPieceApproval({ subtasks: [], deliveredTaskGid: "x" });
  assert.equal(plan.closeRequest, true);
  assert.equal(plan.approved, null);
  assert.deepEqual(plan.remaining, []);
});

test("aprobar una pieza con otras abiertas no cierra la solicitud", () => {
  const plan = planPieceApproval({ subtasks, deliveredTaskGid: "a" });
  assert.equal(plan.closeRequest, false);
  assert.deepEqual(plan.approved, { gid: "a", name: "Invitación" });
  assert.deepEqual(plan.remaining, [{ gid: "c", name: "Presentación" }]);
});

test("aprobar la última pieza abierta cierra la solicitud", () => {
  const plan = planPieceApproval({
    subtasks: subtasks.map((task) =>
      task.gid === "a" ? { ...task, completed: true } : task,
    ),
    deliveredTaskGid: "c",
  });
  assert.equal(plan.closeRequest, true);
  assert.deepEqual(plan.approved, { gid: "c", name: "Presentación" });
});

test("entrega desde la tarea principal con piezas abiertas: no cierra", () => {
  const plan = planPieceApproval({ subtasks, deliveredTaskGid: "parent" });
  assert.equal(plan.approved, null);
  assert.equal(plan.closeRequest, false);
  assert.equal(plan.remaining.length, 2);
});

test("pieceLabel limpia espacios y descarta vacíos", () => {
  assert.equal(
    pieceLabel("  Invitación   «Últimos cupos» "),
    "Invitación «Últimos cupos»",
  );
  assert.equal(pieceLabel(""), null);
  assert.equal(pieceLabel(null), null);
});
