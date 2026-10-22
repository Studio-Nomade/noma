import assert from "node:assert/strict";
import test from "node:test";
import { CRON_JOBS, gateCronRequest, isCronEnabled, type CronJob } from "./cron";

const req = (auth?: string) =>
  new Request("https://noma.test/api/cron/x", {
    headers: auth ? { authorization: auth } : {},
  });

test("los crons parten apagados", () => {
  for (const job of Object.keys(CRON_JOBS) as CronJob[]) {
    assert.equal(isCronEnabled(job, {}), false, job);
  }
});

test("la bandera acepta true, 1 y on", () => {
  for (const value of ["true", "TRUE", "1", "on", " on "]) {
    assert.equal(
      isCronEnabled("whatsapp-drain", { CRON_WHATSAPP_DRAIN_ENABLED: value }),
      true,
      value,
    );
  }
  for (const value of ["false", "0", "", "yes"]) {
    assert.equal(
      isCronEnabled("whatsapp-drain", { CRON_WHATSAPP_DRAIN_ENABLED: value }),
      false,
      value,
    );
  }
});

test("sin CRON_SECRET responde 503", () => {
  const gate = gateCronRequest(req("Bearer x"), "retainers-open", {
    CRON_RETAINERS_OPEN_ENABLED: "true",
  });
  assert.equal(gate.ok, false);
  if (!gate.ok) assert.equal(gate.status, 503);
});

test("credencial incorrecta responde 401 aunque el cron esté apagado", () => {
  const env = { CRON_SECRET: "s3cret" };
  for (const auth of [undefined, "Bearer otro", "s3cret", "Bearer s3cret2"]) {
    const gate = gateCronRequest(req(auth), "email-maintenance", env);
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.status, 401, String(auth));
  }
});

test("credencial correcta y cron apagado: 200 con skipped", () => {
  const gate = gateCronRequest(req("Bearer s3cret"), "email-maintenance", {
    CRON_SECRET: "s3cret",
  });
  assert.equal(gate.ok, false);
  if (!gate.ok) {
    assert.equal(gate.status, 200);
    assert.match(String(gate.body.skipped), /CRON_EMAIL_MAINTENANCE_ENABLED/);
  }
});

test("credencial correcta y cron encendido: pasa", () => {
  const gate = gateCronRequest(req("Bearer s3cret"), "whatsapp-drain", {
    CRON_SECRET: "s3cret",
    CRON_WHATSAPP_DRAIN_ENABLED: "true",
  });
  assert.deepEqual(gate, { ok: true });
});
