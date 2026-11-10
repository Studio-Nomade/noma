import assert from "node:assert/strict";
import test from "node:test";
import type { StructuredGenerator } from "./extract";
import {
  classifyReply,
  normalizeReplyClassification,
  type ReplyClassification,
} from "./reply-classify";

const DATE = new Date("2026-11-13T12:00:00Z");
const BASE: ReplyClassification = {
  kind: "approval",
  points: [],
  adjustments: [],
  doubts: [],
  new_due_date: null,
  new_priority: null,
  new_format: null,
};

test("sin entrega enviada no hay aprobación ni ajustes", () => {
  const ctx = { lastDeliveryRound: null, date: DATE };
  assert.equal(normalizeReplyClassification(BASE, ctx).kind, "info");
  const adj = normalizeReplyClassification(
    {
      ...BASE,
      kind: "adjustments",
      adjustments: [{ text: "Cambiar color", reference: null }],
    },
    ctx,
  );
  assert.equal(adj.kind, "info");
  assert.deepEqual(adj.adjustments, []);
  assert.deepEqual(adj.points, ["Cambiar color"]);
});

test("una aprobación con cambios es ajustes; ajustes sin lista es ambigua", () => {
  const ctx = { lastDeliveryRound: 1, date: DATE };
  const mixed = normalizeReplyClassification(
    { ...BASE, adjustments: [{ text: " Bajar música ", reference: " 0:08 " }] },
    ctx,
  );
  assert.equal(mixed.kind, "adjustments");
  assert.deepEqual(mixed.adjustments, [
    { text: "Bajar música", reference: "0:08" },
  ]);
  assert.equal(
    normalizeReplyClassification({ ...BASE, kind: "adjustments" }, ctx).kind,
    "ambiguous",
  );
  assert.equal(normalizeReplyClassification(BASE, ctx).kind, "approval");
});

test("descarta fechas pasadas", () => {
  const out = normalizeReplyClassification(
    { ...BASE, kind: "info", new_due_date: "2025-01-01" },
    { lastDeliveryRound: null, date: DATE },
  );
  assert.equal(out.new_due_date, null);
});

test("sin IA no clasifica; sin texto es empty; error del modelo no lanza", async () => {
  const ctx = {
    folio: "CA-NOV-0042",
    title: "Video",
    lastDeliveryRound: 1,
    openQuestions: ["¿Música?"],
    fromName: "Ana",
    date: DATE,
    body: "Aprobado!",
  };
  assert.equal((await classifyReply(ctx, null)).classification, null);
  assert.equal(
    (await classifyReply({ ...ctx, body: "  " }, async () => BASE as never))
      .classification?.kind,
    "empty",
  );
  const failing: StructuredGenerator = async () => {
    throw new Error("timeout");
  };
  const failed = await classifyReply(ctx, failing);
  assert.equal(failed.classification, null);
  assert.equal(failed.error, "timeout");

  let prompt = "";
  const ok: StructuredGenerator = async <T>(input: { input: string }) => {
    prompt = input.input;
    return BASE as T;
  };
  assert.equal((await classifyReply(ctx, ok)).classification?.kind, "approval");
  assert.match(prompt, /Última entrega enviada: Entrega 01/);
  assert.match(prompt, /- ¿Música\?/);
});
