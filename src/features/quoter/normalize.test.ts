import { test } from "node:test";
import assert from "node:assert/strict";
import { listToRichText, normalizeDraft, type CatalogRef } from "./normalize";
import type { ProposalDraft } from "./schema";

const catalog: CatalogRef[] = [
  {
    id: "svc-brochure",
    name: "Brochure",
    area: "B&D",
    enabledTiers: [
      { tier: "START", min: 8, currency: "UF" },
      { tier: "GROWTH", min: 11, currency: "UF" },
    ],
  },
  { id: "svc-old", name: "Legado", area: "WD", enabledTiers: [] },
];

function draft(
  lines: ProposalDraft["lines"],
  extra: Partial<ProposalDraft> = {},
): ProposalDraft {
  return {
    title: "Cliente | Propuesta",
    summary_for_team: "",
    confidence: "media",
    lines,
    discount: null,
    sections: {
      context: "",
      diagnosis: "",
      main_objective: "",
      specific_objectives: "",
      scope: "",
      work_stages: [],
      deliverables: [],
      timeline: "",
      client_requirements: "",
      exclusions: "",
      commercial_conditions: "",
      next_action: "",
    },
    team: [],
    open_questions: [],
    applied_learning_ids: [],
    precedent_ids: [],
    ...extra,
  };
}

const known = { learningIds: ["l1"], precedentIds: ["p1"], teamIds: ["m1"] };

test("línea del catálogo: valor igual al catálogo queda null; distinto queda como valor propio", () => {
  const out = normalizeDraft(
    draft([
      {
        kind: "catalogo",
        service_id: "svc-brochure",
        tier: "START",
        quantity: 1,
        unit_price: 8,
        currency: "UF",
        rationale: "r",
        custom: null,
      },
    ]),
    catalog,
    known,
  );
  assert.equal(out.lines[0].unitPrice, null);
  const out2 = normalizeDraft(
    draft([
      {
        kind: "catalogo",
        service_id: "svc-brochure",
        tier: "START",
        quantity: 2.4,
        unit_price: 7,
        currency: "UF",
        rationale: "r",
        custom: null,
      },
    ]),
    catalog,
    known,
  );
  assert.equal(out2.lines[0].unitPrice, 7);
  assert.equal(out2.lines[0].quantity, 2);
});

test("nivel no habilitado cae a START con aviso; duplicados se descartan", () => {
  const out = normalizeDraft(
    draft([
      {
        kind: "catalogo",
        service_id: "svc-brochure",
        tier: "ENTERPRISE",
        quantity: 1,
        unit_price: null,
        currency: "UF",
        rationale: "",
        custom: null,
      },
      {
        kind: "catalogo",
        service_id: "svc-brochure",
        tier: "START",
        quantity: 1,
        unit_price: null,
        currency: "UF",
        rationale: "",
        custom: null,
      },
    ]),
    catalog,
    known,
  );
  assert.equal(out.lines.length, 1);
  assert.equal(out.lines[0].tier, "START");
  assert.equal(out.warnings.length, 2);
});

test("id inexistente sin ficha se omite; con ficha pasa a personalizado", () => {
  const custom = {
    name: "Auditoría digital",
    area: "B&D" as const,
    subarea: "Estrategia de Marca",
    unit: "Único",
    description: "Diagnóstico",
    methodology: ["1. Revisión", "Informe"],
    deliverables: ["Documento"],
    exclusions: ["Implementación"],
    estimated_time: "2 semanas",
    based_on_service_id: "no-existe",
  };
  const out = normalizeDraft(
    draft([
      {
        kind: "catalogo",
        service_id: "fantasma",
        tier: "START",
        quantity: 1,
        unit_price: 5,
        currency: "UF",
        rationale: "",
        custom: null,
      },
      {
        kind: "catalogo",
        service_id: "fantasma-2",
        tier: "GROWTH",
        quantity: 1,
        unit_price: 6,
        currency: "UF",
        rationale: "",
        custom,
      },
    ]),
    catalog,
    known,
  );
  assert.equal(out.lines.length, 1);
  assert.equal(out.lines[0].kind, "personalizado");
  assert.equal(out.lines[0].tier, "START");
  assert.equal(out.lines[0].custom?.basedOnServiceId, null);
  assert.match(out.lines[0].custom?.methodology ?? "", /^noma-rich:v1:/);
  assert.match(out.lines[0].custom?.methodology ?? "", /"Revisión"/);
});

test("descuento acotado y referencias filtradas a lo conocido", () => {
  const out = normalizeDraft(
    draft(
      [
        {
          kind: "catalogo",
          service_id: "svc-brochure",
          tier: "GROWTH",
          quantity: 1,
          unit_price: null,
          currency: "UF",
          rationale: "",
          custom: null,
        },
      ],
      {
        discount: { label: "Pack", kind: "percent", value: 80, rationale: "" },
        applied_learning_ids: ["l1", "inventado"],
        precedent_ids: ["p1", "p1"],
        team: [
          { member_id: "m1", role: "Dirección" },
          { member_id: "m1", role: "Repetido" },
          { member_id: "x", role: "No existe" },
        ],
      },
    ),
    catalog,
    known,
  );
  assert.equal(out.discount?.value, 50);
  assert.deepEqual(out.appliedLearningIds, ["l1"]);
  assert.deepEqual(out.precedentIds, ["p1"]);
  assert.deepEqual(out.team, [{ memberId: "m1", role: "Dirección" }]);
});

test("listToRichText limpia viñetas y numeración", () => {
  assert.equal(listToRichText([], true), "");
  const value = listToRichText(["- uno", "2) dos"], false);
  assert.match(value, /bulletList/);
  assert.doesNotMatch(value, /"- uno"/);
});
