import { strict as assert } from "node:assert";
import { test } from "node:test";
import { planWebhook, reconcileSince, webhookTarget } from "./webhook-plan";

const active = { status: "active", webhookGid: "123" };

test("plan del webhook de un vínculo", () => {
  const base = { emailProject: false, asanaActive: null };
  assert.equal(
    planWebhook({ ...base, linkActive: true, row: null }),
    "register",
  );
  assert.equal(
    planWebhook({ ...base, linkActive: true, row: active, asanaActive: true }),
    "ok",
  );
  // Asana lo apagó por fallas (o ya no existe): se recrea.
  assert.equal(
    planWebhook({ ...base, linkActive: true, row: active, asanaActive: false }),
    "register",
  );
  assert.equal(
    planWebhook({
      ...base,
      linkActive: true,
      row: { status: "failed", webhookGid: null },
    }),
    "register",
  );
  assert.equal(
    planWebhook({ ...base, linkActive: false, row: active }),
    "remove",
  );
  assert.equal(planWebhook({ ...base, linkActive: false, row: null }), "keep");
  // El flujo de correo necesita su webhook aunque se apaguen los avisos.
  assert.equal(
    planWebhook({
      ...base,
      emailProject: true,
      linkActive: false,
      row: active,
    }),
    "keep",
  );
});

test("target y ventana de reconciliación", () => {
  assert.equal(
    webhookTarget("https://noma.example.cl/", "42"),
    "https://noma.example.cl/api/webhooks/asana?project=42",
  );
  const now = new Date("2026-11-20T12:00:00Z");
  assert.equal(
    reconcileSince(now, new Date("2026-11-01T00:00:00Z")).toISOString(),
    "2026-11-19T12:00:00.000Z",
  );
  // Un vínculo nuevo no publica comentarios de antes de existir.
  assert.equal(
    reconcileSince(now, new Date("2026-11-20T10:00:00Z")).toISOString(),
    "2026-11-20T10:00:00.000Z",
  );
});
