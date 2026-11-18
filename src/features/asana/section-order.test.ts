import assert from "node:assert/strict";
import test from "node:test";
import {
  desiredFolioOrder,
  folioNumber,
  planFolioOrder,
  type SectionTask,
} from "./section-order";

const task = (gid: string, name: string): SectionTask => ({ gid, name });

function apply(tasks: SectionTask[], moves: ReturnType<typeof planFolioOrder>) {
  const order = tasks.map((item) => item.gid);
  for (const move of moves) {
    order.splice(order.indexOf(move.task), 1);
    order.splice(order.indexOf(move.before), 0, move.task);
  }
  return order;
}

test("lee el número del folio", () => {
  assert.equal(folioNumber("[ABC-NOV-0593] Piezas"), 593);
  assert.equal(folioNumber("[G36-DIC-0012] Video"), 12);
  assert.equal(folioNumber("Ajustes piezas evento"), null);
});

test("la solicitud nueva queda primera con un solo movimiento", () => {
  const tasks = [
    task("a", "[ABC-NOV-0595] C"),
    task("b", "[ABC-NOV-0594] B"),
    task("c", "[ABC-NOV-0593] A"),
    task("n", "[ABC-NOV-0596] Nueva"),
  ];
  const moves = planFolioOrder(tasks);
  assert.deepEqual(moves, [{ task: "n", before: "a" }]);
  assert.deepEqual(apply(tasks, moves), ["n", "a", "b", "c"]);
});

test("ordena de mayor a menor y deja las sin folio al final", () => {
  const tasks = [
    task("x", "Tarea manual"),
    task("c", "[ABC-NOV-0593] A"),
    task("a", "[ABC-NOV-0595] C"),
    task("b", "[ABC-NOV-0594] B"),
  ];
  assert.deepEqual(desiredFolioOrder(tasks), ["a", "b", "c", "x"]);
  assert.deepEqual(apply(tasks, planFolioOrder(tasks)), ["a", "b", "c", "x"]);
});

test("ya ordenada: sin movimientos", () => {
  const tasks = [task("a", "[ABC-NOV-0002] B"), task("b", "[ABC-NOV-0001] A")];
  assert.deepEqual(planFolioOrder(tasks), []);
});
