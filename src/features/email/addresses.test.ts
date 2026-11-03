import assert from "node:assert/strict";
import test from "node:test";
import {
  externalRecipients,
  isAllowedSenderDomain,
  isPublicEmailDomain,
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

test("el nombre visible entre comillas no puede suplantar la dirección", () => {
  assert.deepEqual(
    parseAddressList('"Boss <boss@client.cl>" <attacker@evil.com>'),
    [{ name: "Boss <boss@client.cl>", email: "attacker@evil.com" }],
  );
  assert.deepEqual(
    parseAddressList('"a\\"b <x@client.cl>" <attacker@evil.com>'),
    [{ name: 'a"b <x@client.cl>', email: "attacker@evil.com" }],
  );
  // Sin comillas: se usa el ÚLTIMO <...>.
  assert.equal(
    parseAddressList("Boss <boss@client.cl> <attacker@evil.com>")[0].email,
    "attacker@evil.com",
  );
  // Dirección sin <...>: el texto entre comillas no cuenta.
  assert.deepEqual(parseAddressList('"boss@client.cl" attacker@evil.com'), [
    { name: null, email: "attacker@evil.com" },
  ]);
});

test("dominios de correo público nunca son dominio autorizado", () => {
  assert.equal(isAllowedSenderDomain("x@gmail.com", ["gmail.com"]), false);
  assert.equal(isPublicEmailDomain("Outlook.com"), true);
  assert.equal(isPublicEmailDomain("cliente.cl"), false);
});
