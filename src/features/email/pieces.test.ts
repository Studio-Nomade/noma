import assert from "node:assert/strict";
import test from "node:test";
import {
  duplicatedProjects,
  pieceFieldValues,
  pieceLabel,
  planPieceApproval,
} from "./pieces";

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

const parentFields = [
  {
    gid: "f",
    name: "Folio NOMA",
    resource_subtype: "text",
    text_value: "ABC-NOV-0001",
  },
  {
    gid: "p",
    name: "Prioridad",
    resource_subtype: "enum",
    enum_value: { gid: "alta" },
  },
  {
    gid: "e",
    name: "Estado",
    resource_subtype: "enum",
    enum_value: { gid: "plan" },
  },
  {
    gid: "t",
    name: "¿Ticket Activo?",
    resource_subtype: "enum",
    enum_value: { gid: "si" },
  },
  {
    gid: "c",
    name: "Correo de Contacto",
    resource_subtype: "text",
    text_value: "a@b.cl",
  },
  {
    gid: "a",
    name: "Área",
    resource_subtype: "multi_enum",
    multi_enum_values: [{ gid: "b2b" }],
  },
  {
    gid: "fm",
    name: "Formato",
    resource_subtype: "multi_enum",
    multi_enum_values: [{ gid: "png" }],
  },
];

test("la pieza hereda los campos vacíos y el folio de la solicitud", () => {
  const values = pieceFieldValues(parentFields, [
    {
      gid: "f",
      name: "Folio NOMA",
      resource_subtype: "text",
      text_value: "0001",
    },
    {
      gid: "p",
      name: "Prioridad",
      resource_subtype: "enum",
      enum_value: { gid: "media" },
    },
    { gid: "e", name: "Estado", resource_subtype: "enum", enum_value: null },
    {
      gid: "t",
      name: "¿Ticket Activo?",
      resource_subtype: "enum",
      enum_value: null,
    },
    {
      gid: "c",
      name: "Correo de Contacto",
      resource_subtype: "text",
      text_value: "",
    },
    {
      gid: "a",
      name: "Área",
      resource_subtype: "multi_enum",
      multi_enum_values: [],
    },
    {
      gid: "fm",
      name: "Formato",
      resource_subtype: "multi_enum",
      multi_enum_values: [],
    },
  ]);
  assert.deepEqual(values, {
    f: "ABC-NOV-0001",
    t: "si",
    c: "a@b.cl",
    a: ["b2b"],
  });
});

test("sin cambios cuando la pieza ya está completa", () => {
  assert.deepEqual(pieceFieldValues(parentFields, parentFields), {});
});

test("detecta proyectos compartidos con la solicitud", () => {
  assert.deepEqual(
    duplicatedProjects([{ gid: "p1" }], [{ gid: "p1" }, { gid: "p2" }]),
    ["p1"],
  );
  assert.deepEqual(duplicatedProjects([{ gid: "p1" }], []), []);
});
