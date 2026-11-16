import { test } from "node:test";
import assert from "node:assert/strict";
import { describeChanges } from "./learn-diff";

const base = {
  draftSections: {
    scope: "Diseño de brochure en Canva con material del cliente.",
  },
  finalSections: {
    scope: "Diseño de brochure en Canva con material del cliente.",
  },
};

test("sin cambios no hay nada que aprender", () => {
  const line = {
    serviceId: "a",
    name: "Brochure",
    tier: "START",
    quantity: 1,
    amount: 8,
    currency: "UF",
  };
  assert.deepEqual(
    describeChanges({
      ...base,
      draftLines: [line],
      finalLines: [line],
      draftDiscount: null,
      finalDiscount: { kind: null, value: null },
    }),
    [],
  );
});

test("detecta valor, nivel, líneas y descuento", () => {
  const changes = describeChanges({
    ...base,
    draftLines: [
      {
        serviceId: "a",
        name: "Brochure",
        tier: "START",
        quantity: 1,
        amount: 8,
        currency: "UF",
      },
      {
        serviceId: "b",
        name: "Video",
        tier: "START",
        quantity: 1,
        amount: 13,
        currency: "UF",
      },
    ],
    finalLines: [
      {
        serviceId: "a",
        name: "Brochure",
        tier: "GROWTH",
        quantity: 1,
        amount: 7,
        currency: "UF",
      },
      {
        serviceId: "c",
        name: "Auditoría",
        tier: "START",
        quantity: 1,
        amount: 6,
        currency: "UF",
      },
    ],
    draftDiscount: null,
    finalDiscount: { kind: "percent", value: 10 },
  });
  assert.ok(changes.some((c) => c.includes("de START a GROWTH")));
  assert.ok(changes.some((c) => c.includes("de 8 UF a 7 UF")));
  assert.ok(changes.some((c) => c.startsWith("Quitó «Video»")));
  assert.ok(changes.some((c) => c.startsWith("Agregó «Auditoría»")));
  assert.ok(changes.some((c) => c.includes("descuento de 10 percent")));
});

test("una sección reescrita aparece con su texto final", () => {
  const changes = describeChanges({
    draftLines: [],
    finalLines: [],
    draftDiscount: null,
    finalDiscount: null,
    draftSections: {
      exclusions: "Impresión de piezas y licencias de software.",
    },
    finalSections: {
      exclusions: "No incluye fotografía de producto ni pauta pagada.",
    },
  });
  assert.equal(changes.length, 1);
  assert.match(changes[0], /fotografía de producto/);
});
