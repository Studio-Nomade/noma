import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanTaskTitle,
  contactEmailFrom,
  decideThreadOpen,
  hasNomaFolio,
  openedSubject,
  openedTaskName,
  summaryFromNotes,
  taskSourceKey,
} from "./thread-open-rules";

const since = "2026-11-21T03:00:00.000Z";
const base = {
  name: "Mailing promo Live",
  completed: false,
  isSubtask: false,
  contactField: "contacto@cliente.cl",
  createdAt: "2026-11-22T14:00:00.000Z",
  since,
};

test("abre el hilo con correo de contacto y título", () => {
  assert.deepEqual(decideThreadOpen(base), {
    open: true,
    contactEmail: "contacto@cliente.cl",
    title: "Mailing promo Live",
  });
});

test("no abre: subtarea, completada, con folio, sin contacto, antigua", () => {
  const reason = (patch: Partial<typeof base>) => {
    const decision = decideThreadOpen({ ...base, ...patch });
    return decision.open ? "open" : decision.reason;
  };
  assert.equal(reason({ isSubtask: true }), "subtarea");
  assert.equal(reason({ completed: true }), "completada");
  assert.equal(reason({ name: "[BOX-NOV-0003] Mailing" }), "con_folio");
  assert.equal(reason({ contactField: "" }), "sin_contacto");
  assert.equal(reason({ contactField: "pendiente" }), "sin_contacto");
  assert.equal(reason({ createdAt: "2026-11-20T14:00:00.000Z" }), "anterior");
  assert.equal(reason({ createdAt: "" }), "anterior");
  assert.equal(reason({ name: "  " }), "sin_titulo");
});

test("correo de contacto en varias formas", () => {
  assert.equal(
    contactEmailFrom("Carolina <Carola@Gmail.com>"),
    "carola@gmail.com",
  );
  assert.equal(contactEmailFrom("a@b.cl, c@d.cl"), "a@b.cl");
  assert.equal(contactEmailFrom(null), null);
});

test("nombres, asunto y claves", () => {
  assert.equal(hasNomaFolio("[EQX-NOV-0601] Banner"), true);
  assert.equal(hasNomaFolio("[G360-ADIC] Rebranding"), false);
  assert.equal(cleanTaskTitle("[urgente]  Banner   home"), "Banner home");
  assert.equal(
    openedTaskName("BOX-NOV-0001", "Mailing"),
    "[BOX-NOV-0001] Mailing",
  );
  assert.equal(
    openedSubject("BOX-NOV-0001", "Mailing"),
    "Solicitud registrada · [BOX-NOV-0001] Mailing",
  );
  assert.equal(taskSourceKey("123"), "asana-task:123");
  assert.equal(summaryFromNotes("a\n\n b", 10), "a b");
  assert.equal(summaryFromNotes("x".repeat(20), 10), `${"x".repeat(9)}…`);
});
