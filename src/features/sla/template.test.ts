import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSlaFromTemplate,
  pendingKeys,
  renderTemplate,
  richToPlain,
  type AreaSlaTemplate,
  type SlaServiceInput,
} from "./template";

const RICH =
  'noma-rich:v1:{"type":"doc","content":[{"type":"bulletList","content":[' +
  '{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Layout"}]}]},' +
  '{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"3 renders"}]}]}]}]}';

const service: SlaServiceInput = {
  serviceId: "s1",
  name: "Proyecto de prueba",
  tierLabel: "Growth",
  description: "Diseño de un local.",
  methodology: null,
  deliverables: RICH,
  exclusions: "Obra",
  estimatedTime: "6 semanas",
  valueLabel: "250,00 UF + IVA",
};

const template: AreaSlaTemplate = {
  name: "SLA de prueba",
  sections: [
    { label: "1. General", body: "Cliente {{razon_social}} en {{comuna}}." },
    { label: "2. Servicios", body: "{{servicios}}" },
    { label: "3. Lista", body: "{{servicios_lista}}" },
  ],
  serviceBlock: {
    title: "{{servicio}} · Nivel {{nivel}}",
    body: "Entregables:\n{{entregables}}\nValor: {{valor}}",
  },
  variables: [],
};

test("renderTemplate reemplaza variables y marca las faltantes", () => {
  assert.equal(
    renderTemplate("Hola {{ cliente }}, {{rol}}", { cliente: "Acme", rol: "" }),
    "Hola Acme, [completar: rol]",
  );
});

test("renderTemplate no interpreta patrones de reemplazo en los valores", () => {
  assert.equal(renderTemplate("{{x}}", { x: "$& $1" }), "$& $1");
});

test("richToPlain convierte listas enriquecidas en viñetas", () => {
  assert.equal(richToPlain(RICH), "• Layout\n• 3 renders");
  assert.equal(richToPlain(null), "");
});

test("buildSlaFromTemplate arma bloques por servicio con sus cláusulas", () => {
  const sections = buildSlaFromTemplate({
    template,
    services: [service],
    clausesByService: new Map([["s1", "Pago 40/30/30 para {{cliente}}."]]),
    vars: { razon_social: "Acme SpA", cliente: "Acme" },
  });
  assert.equal(sections[0].body, "Cliente Acme SpA en [completar: comuna].");
  assert.match(sections[1].body, /^3\.1\. Proyecto de prueba · Nivel Growth/);
  assert.match(sections[1].body, /• Layout\n• 3 renders/);
  assert.match(sections[1].body, /Pago 40\/30\/30 para Acme\./);
  assert.equal(sections[2].body, "• Proyecto de prueba · Nivel Growth");
  assert.deepEqual(pendingKeys(sections), ["comuna"]);
});
