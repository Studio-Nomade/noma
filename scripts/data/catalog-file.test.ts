import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogServiceSchema,
  linesToRichText,
  slaTemplateFileSchema,
  undeclaredVariables,
} from "./catalog-file";
import { richToPlain } from "@/features/sla/template";

const variant = (tier: string, enabled = true) => ({
  tier,
  enabled,
  priceMinAmount: 10,
  priceMaxAmount: 12,
  priceCurrency: "UF",
});

test("catalogServiceSchema exige los 4 niveles con Start y Growth activos", () => {
  const ok = catalogServiceSchema.safeParse({
    name: "Servicio",
    subarea: "Sub",
    variants: [
      variant("START"),
      variant("GROWTH"),
      variant("PERFORMANCE", false),
      variant("ENTERPRISE", false),
    ],
  });
  assert.equal(ok.success, true);

  const missingGrowth = catalogServiceSchema.safeParse({
    name: "Servicio",
    subarea: "Sub",
    variants: [
      variant("START"),
      variant("GROWTH", false),
      variant("PERFORMANCE"),
      variant("ENTERPRISE"),
    ],
  });
  assert.equal(missingGrowth.success, false);
});

test("linesToRichText produce texto enriquecido válido", () => {
  const rich = linesToRichText(["Uno", " ", "Dos"]);
  assert.ok(rich?.startsWith("noma-rich:v1:"));
  assert.equal(richToPlain(rich), "• Uno\n• Dos");
  assert.equal(linesToRichText([]), null);
});

test("undeclaredVariables detecta variables sin declarar", () => {
  const file = slaTemplateFileSchema.parse({
    version: "1",
    area: "A&D",
    name: "Prueba",
    variables: [{ key: "cliente", source: "noma" }],
    sections: [{ label: "1", body: "{{cliente}} {{comuna}} {{servicios}}" }],
    service_block: null,
    services: [{ service: "X", clauses: "{{nivel}}" }],
  });
  assert.deepEqual(undeclaredVariables(file).sort(), ["comuna", "nivel"]);
});
