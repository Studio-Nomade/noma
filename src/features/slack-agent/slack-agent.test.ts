import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { cleanSlackText, isCfoRequest, slackAgentEmails } from "./config";
import { verifySlackSignature } from "./signature";

test("verifica la firma de Slack y rechaza las viejas", () => {
  const secret = "s3cr3t";
  const ts = "1795000000";
  const body = "payload=1";
  const sig =
    "v0=" +
    createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex");
  const now = 1795000000 * 1000;
  assert.equal(
    verifySlackSignature({
      signingSecret: secret,
      timestamp: ts,
      signature: sig,
      body,
      now,
    }),
    true,
  );
  assert.equal(
    verifySlackSignature({
      signingSecret: secret,
      timestamp: ts,
      signature: sig,
      body: "x",
      now,
    }),
    false,
  );
  assert.equal(
    verifySlackSignature({
      signingSecret: secret,
      timestamp: ts,
      signature: sig,
      body,
      now: now + 600_000,
    }),
    false,
  );
  assert.equal(
    verifySlackSignature({
      signingSecret: undefined,
      timestamp: ts,
      signature: sig,
      body,
      now,
    }),
    false,
  );
});

test("solicitud CFO, limpieza de texto y usuarios autorizados", () => {
  assert.equal(isCfoRequest("[SOLICITUD] pagar dominio"), true);
  assert.equal(isCfoRequest("  [solicitud]\nTipo: Pago"), true);
  assert.equal(isCfoRequest("hola [SOLICITUD]"), false);
  assert.equal(
    cleanSlackText("<@U123> mira <https://x.cl|el link> &amp; listo"),
    "mira el link (https://x.cl) & listo",
  );
  assert.deepEqual(slackAgentEmails({}), [
    "sebastian@studionomade.cl",
    "ana@studionomade.cl",
  ]);
});
