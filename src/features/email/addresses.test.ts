import assert from "node:assert/strict";
import test from "node:test";
import {
  externalRecipients,
  isAllowedSenderDomain,
  matchAlias,
  parseAddressList,
  routingCandidates,
} from "./addresses";

test("parsea listas con nombres entre comillas y comas", () => {
  assert.deepEqual(
    parseAddressList('"Pérez, Ana" <Ana.Perez@Cliente.cl>, otro@ejemplo.com'),
    [
      { name: "Pérez, Ana", email: "ana.perez@cliente.cl" },
      { name: null, email: "otro@ejemplo.com" },
    ],
  );
  assert.deepEqual(parseAddressList(""), []);
  assert.deepEqual(parseAddressList("sin correo"), []);
});

test("rutea por To, Cc, Delivered-To y X-Original-To en minúsculas", () => {
  const aliases = ["cliente-a@studionomade.cl", "cliente-b@studionomade.cl"];

  // Alias en To.
  assert.equal(
    matchAlias(
      routingCandidates({ to: ["Studio <Cliente-A@StudioNomade.cl>"] }),
      aliases,
    ),
    "cliente-a@studionomade.cl",
  );
  // Alias en CC (el To es una persona del estudio).
  assert.equal(
    matchAlias(
      routingCandidates({
        to: ["persona@studionomade.cl"],
        cc: ["cliente-b@studionomade.cl"],
      }),
      aliases,
    ),
    "cliente-b@studionomade.cl",
  );
  // CCO: solo aparece en Delivered-To / X-Original-To.
  assert.equal(
    matchAlias(
      routingCandidates({
        to: ["equipo@cliente.cl"],
        "delivered-to": ["casilla@studionomade.cl"],
        "x-original-to": ["cliente-a@studionomade.cl"],
      }),
      aliases,
    ),
    "cliente-a@studionomade.cl",
  );
  // X-Forwarded-To (reenvío automático).
  assert.equal(
    matchAlias(
      routingCandidates({ "x-forwarded-to": ["cliente-b@studionomade.cl"] }),
      aliases,
    ),
    "cliente-b@studionomade.cl",
  );
  // Sin alias conocido.
  assert.equal(
    matchAlias(routingCandidates({ to: ["casilla@studionomade.cl"] }), aliases),
    null,
  );
});

test("To tiene prioridad sobre Cc cuando hay dos alias", () => {
  assert.equal(
    matchAlias(
      routingCandidates({
        to: ["cliente-b@studionomade.cl"],
        cc: ["cliente-a@studionomade.cl"],
      }),
      ["cliente-a@studionomade.cl", "cliente-b@studionomade.cl"],
    ),
    "cliente-b@studionomade.cl",
  );
});

test("valida dominios autorizados exactos y subdominios", () => {
  assert.equal(isAllowedSenderDomain("ana@cliente.cl", ["cliente.cl"]), true);
  assert.equal(
    isAllowedSenderDomain("ana@mkt.cliente.cl", ["@Cliente.cl"]),
    true,
  );
  assert.equal(
    isAllowedSenderDomain("ana@otrocliente.cl", ["cliente.cl"]),
    false,
  );
  assert.equal(
    isAllowedSenderDomain("ana@cliente.cl.evil.com", ["cliente.cl"]),
    false,
  );
  assert.equal(isAllowedSenderDomain("ana@cliente.cl", []), false);
});

test("excluye casillas propias y duplicados del CC", () => {
  assert.deepEqual(
    externalRecipients(
      [
        "A@cliente.cl",
        "cliente-a@studionomade.cl",
        "a@cliente.cl",
        "b@cliente.cl",
      ],
      ["cliente-a@studionomade.cl"],
    ),
    ["a@cliente.cl", "b@cliente.cl"],
  );
});
