import assert from "node:assert/strict";
import test from "node:test";
import { findEnumOption, type AsanaCustomFieldSetting } from "./custom-fields";
import {
  signAsanaBody,
  storyAddedEvents,
  verifyAsanaSignature,
} from "./webhook-events";

test("verifica X-Hook-Signature (HMAC-SHA256 hex)", () => {
  const body = JSON.stringify({ events: [] });
  const secret = "secreto-de-prueba";
  const signature = signAsanaBody(body, secret);
  assert.equal(verifyAsanaSignature(body, signature, secret), true);
  assert.equal(
    verifyAsanaSignature(body, signature.toUpperCase(), secret),
    true,
  );
  assert.equal(verifyAsanaSignature(`${body} `, signature, secret), false);
  assert.equal(verifyAsanaSignature(body, signature, "otro"), false);
  assert.equal(verifyAsanaSignature(body, null, secret), false);
  assert.equal(verifyAsanaSignature(body, "zz", secret), false);
  assert.equal(verifyAsanaSignature(body, signature, null), false);
});

test("filtra eventos de comentarios agregados y sin duplicados", () => {
  const events = storyAddedEvents({
    events: [
      {
        action: "added",
        user: { gid: "u1" },
        resource: {
          gid: "s1",
          resource_type: "story",
          resource_subtype: "comment_added",
        },
        parent: { gid: "t1", resource_type: "task" },
      },
      {
        action: "added",
        resource: {
          gid: "s1",
          resource_type: "story",
          resource_subtype: "comment_added",
        },
        parent: { gid: "t1", resource_type: "task" },
      },
      {
        action: "added",
        resource: {
          gid: "s2",
          resource_type: "story",
          resource_subtype: "assigned",
        },
        parent: { gid: "t1", resource_type: "task" },
      },
      {
        action: "changed",
        resource: { gid: "t1", resource_type: "task" },
      },
      {
        action: "added",
        resource: { gid: "s3", resource_type: "story" },
        parent: { gid: "t2", resource_type: "task" },
      },
    ],
  });
  assert.deepEqual(events, [
    { storyGid: "s1", taskGid: "t1", userGid: "u1", subtype: "comment_added" },
    { storyGid: "s3", taskGid: "t2", userGid: null, subtype: null },
  ]);
  assert.deepEqual(storyAddedEvents(null), []);
});

test("resuelve opciones enum por nombre sin tildes ni mayúsculas", () => {
  const settings: AsanaCustomFieldSetting[] = [
    {
      custom_field: {
        gid: "f1",
        name: "Estado",
        resource_subtype: "enum",
        enum_options: [
          { gid: "o1", name: "En curso" },
          { gid: "o2", name: "Enviado a Cliente" },
          { gid: "o3", name: "Con ajustes", enabled: false },
        ],
      },
    },
    { custom_field: { gid: "f2", name: "Folio", resource_subtype: "text" } },
  ];
  assert.deepEqual(findEnumOption(settings, "estado", "enviado a cliente"), {
    fieldGid: "f1",
    optionGid: "o2",
    optionName: "Enviado a Cliente",
  });
  assert.equal(findEnumOption(settings, "Estado", "Con ajustes"), null); // deshabilitada
  assert.equal(findEnumOption(settings, "Folio", "x"), null); // no es enum
  assert.equal(findEnumOption(settings, "Prioridad", "Alta"), null);
  assert.equal(
    findEnumOption(settings, "Estado", ["No existe", "En curso"])?.optionGid,
    "o1",
  );
});
