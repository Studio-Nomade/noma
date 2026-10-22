import assert from "node:assert/strict";
import test from "node:test";
import { decideFollowup, type FollowupInput } from "./followup";

const now = new Date("2026-10-22T12:00:00Z");
const base: FollowupInput = {
  status: "EMITIDA",
  total: 1_000_000,
  montoConciliado: 0,
  fechaEmision: "2026-10-01",
  sentAt: "2026-10-10T12:00:00Z",
};

test("a los 7 días del envío sin pago corresponde P3", () => {
  const d = decideFollowup(base, now);
  assert.equal(d.send, true);
  assert.equal(d.reason, "ENVIAR");
  assert.equal(d.daysSinceSent, 12);
});

test("antes de 7 días no se envía y entrega la próxima fecha", () => {
  const d = decideFollowup({ ...base, sentAt: "2026-10-18T12:00:00Z" }, now);
  assert.equal(d.send, false);
  assert.equal(d.reason, "AUN_NO");
  assert.equal(d.nextDate, "2026-10-25");
});

test("sin registro de envío usa la fecha de emisión", () => {
  const d = decideFollowup({ ...base, sentAt: null }, now);
  assert.equal(d.send, true);
  assert.equal(d.daysSinceSent, 21);
});

test("pagada o conciliada se suprime", () => {
  assert.equal(
    decideFollowup({ ...base, status: "CONCILIADA" }, now).reason,
    "PAGADA",
  );
  assert.equal(
    decideFollowup({ ...base, montoConciliado: 1_000_000 }, now).reason,
    "PAGADA",
  );
});

test("nota de crédito o anulada se suprime", () => {
  assert.equal(
    decideFollowup({ ...base, hasCreditNote: true }, now).reason,
    "ANULADA",
  );
  assert.equal(
    decideFollowup({ ...base, status: "ANULADA" }, now).reason,
    "ANULADA",
  );
});

test("factura cedida a factoring no se cobra al cliente", () => {
  const d = decideFollowup({ ...base, factoringAt: "2026-10-05" }, now);
  assert.equal(d.send, false);
  assert.equal(d.reason, "FACTORING");
});

test("cobranza legal y pausa se suprimen", () => {
  assert.equal(
    decideFollowup({ ...base, legalAt: "2026-10-20" }, now).reason,
    "COBRANZA_LEGAL",
  );
  assert.equal(
    decideFollowup({ ...base, paused: true }, now).reason,
    "PAUSADA",
  );
});

test("fecha comprometida vigente suprime; vencida vuelve a seguimiento", () => {
  assert.equal(
    decideFollowup({ ...base, committedPaymentDate: "2026-10-28" }, now).reason,
    "FECHA_COMPROMETIDA",
  );
  assert.equal(
    decideFollowup({ ...base, committedPaymentDate: "2026-10-15" }, now).send,
    true,
  );
});

test("seguimiento reciente espera 7 días más", () => {
  const d = decideFollowup(
    { ...base, lastFollowupAt: "2026-10-19T12:00:00Z", followupCount: 1 },
    now,
  );
  assert.equal(d.reason, "RECIENTE");
  assert.equal(d.nextDate, "2026-10-26");
});

test("al llegar al máximo queda para revisión humana", () => {
  const d = decideFollowup({ ...base, followupCount: 3 }, now);
  assert.equal(d.send, false);
  assert.equal(d.reason, "MAXIMO");
});
