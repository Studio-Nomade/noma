import assert from "node:assert/strict";
import test from "node:test";
import { isSelfAuthenticatedPath } from "./self-authenticated-paths";

test("webhooks y crons se saltan la sesión", () => {
  for (const path of [
    "/api/webhooks/whatsapp",
    "/api/webhooks/gmail",
    "/api/webhooks/asana",
    "/api/cron/whatsapp-drain",
    "/api/cron/email-maintenance",
    "/api/webhooks",
    "/api/cron",
  ]) {
    assert.equal(isSelfAuthenticatedPath(path), true, path);
  }
});

test("el resto de rutas sigue exigiendo sesión", () => {
  for (const path of [
    "/",
    "/solicitudes",
    "/api/integrations/asana/connect",
    "/api/webhooksfoo",
    "/api/cronjobs",
    "/api/webhook/gmail",
    "/webhooks/gmail",
    "/x/api/webhooks/gmail",
  ]) {
    assert.equal(isSelfAuthenticatedPath(path), false, path);
  }
});
