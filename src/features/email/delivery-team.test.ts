import assert from "node:assert/strict";
import test from "node:test";
import { MAX_THREAD_CC, deliveryCc } from "./delivery-team";

const base = {
  studioDomain: "studionomade.cl",
  exclude: ["daniela@grado360.cl", "grado360@studionomade.cl"],
};

test("quien comenta queda en copia aunque la tarea no tenga responsable", () => {
  assert.deepEqual(
    deliveryCc({
      ...base,
      requestCc: [],
      commenterEmail: "javiera@studionomade.cl",
      assigneeEmail: null,
    }),
    ["javiera@studionomade.cl"],
  );
});

test("responsable y quien ejecuta van los dos, sin duplicar", () => {
  assert.deepEqual(
    deliveryCc({
      ...base,
      requestCc: ["angeles@grado360.cl", "Javiera@studionomade.cl"],
      commenterEmail: "javiera@studionomade.cl",
      assigneeEmail: "catalina@studionomade.cl",
    }),
    [
      "javiera@studionomade.cl",
      "catalina@studionomade.cl",
      "angeles@grado360.cl",
    ],
  );
  assert.deepEqual(
    deliveryCc({
      ...base,
      requestCc: [],
      commenterEmail: "catalina@studionomade.cl",
      assigneeEmail: "catalina@studionomade.cl",
    }),
    ["catalina@studionomade.cl"],
  );
});

test("solo suma direcciones del estudio y nunca al solicitante ni al alias", () => {
  assert.deepEqual(
    deliveryCc({
      ...base,
      requestCc: ["daniela@grado360.cl"],
      commenterEmail: "externo@gmail.com",
      assigneeEmail: "grado360@studionomade.cl",
    }),
    [],
  );
});

test("el tope de copias nunca deja fuera al equipo", () => {
  const requestCc = Array.from({ length: 20 }, (_, i) => `c${i}@cliente.cl`);
  const cc = deliveryCc({
    ...base,
    requestCc,
    commenterEmail: "javiera@studionomade.cl",
    assigneeEmail: "catalina@studionomade.cl",
  });
  assert.equal(cc.length, MAX_THREAD_CC);
  assert.deepEqual(cc.slice(0, 2), [
    "javiera@studionomade.cl",
    "catalina@studionomade.cl",
  ]);
});

test("encargado de la cuenta en copia aunque entregue otra persona", () => {
  assert.deepEqual(
    deliveryCc({
      studioDomain: "studionomade.cl",
      exclude: ["cliente@empresa.cl", "cliente@studionomade.cl"],
      requestCc: [],
      commenterEmail: "javiera@studionomade.cl",
      managerEmail: "catalina@studionomade.cl",
      assigneeEmail: "sebastian@studionomade.cl",
    }),
    [
      "javiera@studionomade.cl",
      "catalina@studionomade.cl",
      "sebastian@studionomade.cl",
    ],
  );
  // Si el encargado es quien comenta o el responsable, va una sola vez; un
  // encargado fuera del estudio nunca va en copia.
  assert.deepEqual(
    deliveryCc({
      studioDomain: "studionomade.cl",
      exclude: [],
      requestCc: [],
      commenterEmail: "catalina@studionomade.cl",
      managerEmail: "Catalina@studionomade.cl",
      assigneeEmail: "catalina@studionomade.cl",
    }),
    ["catalina@studionomade.cl"],
  );
  assert.deepEqual(
    deliveryCc({
      studioDomain: "studionomade.cl",
      exclude: [],
      requestCc: [],
      commenterEmail: null,
      managerEmail: "externo@otra.cl",
      assigneeEmail: null,
    }),
    [],
  );
});
