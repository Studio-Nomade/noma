import { test } from "node:test";
import assert from "node:assert/strict";
import {
  capabilityStatus,
  LEGACY_SCOPES,
  missingCount,
  parseScopes,
} from "./capabilities";

const G = "https://www.googleapis.com/auth/";

test("Google: gmail.modify cubre leer, enviar y borradores; falta Drive", () => {
  const status = capabilityStatus("google", [
    "email",
    `${G}gmail.modify`,
    `${G}calendar.events`,
  ]);
  const byId = Object.fromEntries(status.map((s) => [s.id, s.granted]));
  assert.deepEqual(byId, {
    gmail_send: true,
    gmail_read: true,
    gmail_drafts: true,
    calendar: true,
    drive: false,
  });
  assert.equal(missingCount(status), 1);
});

test("Slack: separa por comas y detecta lo que falta", () => {
  const granted = parseScopes("channels:read,groups:read,chat:write");
  const status = capabilityStatus("slack", granted);
  assert.deepEqual(
    status.filter((s) => s.granted).map((s) => s.id),
    ["channels", "send"],
  );
});

test("Asana antigua: solo lectura", () => {
  const status = capabilityStatus("asana", LEGACY_SCOPES.asana ?? []);
  assert.deepEqual(
    status.map((s) => s.granted),
    [true, false, false],
  );
});

test("parseScopes tolera vacío y espacios", () => {
  assert.deepEqual(parseScopes(null), []);
  assert.deepEqual(parseScopes(" a  b,c "), ["a", "b", "c"]);
});
