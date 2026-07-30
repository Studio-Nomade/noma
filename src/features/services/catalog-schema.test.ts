import assert from "node:assert/strict";
import test from "node:test";
import { packageSchema } from "./catalog-schema";
import { serviceSchema } from "./schema";
import { SERVICE_TIERS, type ServiceTier } from "./tiers";

const ID_A = "00000000-0000-4000-8000-000000000001";
const ID_B = "00000000-0000-4000-8000-000000000002";

function variant(tier: ServiceTier) {
  return {
    tier,
    enabled: tier === "START" || tier === "GROWTH",
    audience: "",
    focus: "",
    description: "",
    methodology: "",
    deliverables: "",
    exclusions: "",
    estimatedTime: "",
    priceMinAmount: "",
    priceMaxAmount: "",
    priceCurrency: "UF" as const,
  };
}

test("acepta exactamente las cuatro variantes del servicio", () => {
  const result = serviceSchema.safeParse({
    name: "Servicio",
    area: "B&D",
    status: "Activo",
    variants: SERVICE_TIERS.map(variant),
  });
  assert.equal(result.success, true);
});

test("rechaza tiers duplicados aunque el arreglo tenga cuatro elementos", () => {
  const result = serviceSchema.safeParse({
    name: "Servicio",
    area: "B&D",
    status: "Activo",
    variants: [
      variant("START"),
      variant("GROWTH"),
      variant("GROWTH"),
      variant("ENTERPRISE"),
    ],
  });
  assert.equal(result.success, false);
});

test("rechaza el mismo servicio repetido con otra variante en un paquete", () => {
  const result = packageSchema.safeParse({
    name: "Paquete",
    status: "Activo",
    suggestedByAi: false,
    items: [
      { serviceId: ID_A, variantTier: "START", quantity: 1 },
      { serviceId: ID_A, variantTier: "GROWTH", quantity: 1 },
    ],
  });
  assert.equal(result.success, false);
});

test("acepta servicios distintos dentro de un paquete", () => {
  const result = packageSchema.safeParse({
    name: "Paquete",
    status: "Activo",
    suggestedByAi: false,
    items: [
      { serviceId: ID_A, variantTier: "START", quantity: 1 },
      { serviceId: ID_B, variantTier: "GROWTH", quantity: 2 },
    ],
  });
  assert.equal(result.success, true);
});
