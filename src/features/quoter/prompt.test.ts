import { test } from "node:test";
import assert from "node:assert/strict";
import {
  draftSystemBlocks,
  draftUserInput,
  renderCatalog,
  renderLearnings,
  renderPrecedents,
} from "./prompt";
import { orTsQuery, searchTerms } from "./search";
import { quoterAiConfig } from "./ai-config";

test("catálogo compacto con ids, niveles e historial", () => {
  const text = renderCatalog([
    {
      id: "s1",
      name: "Brochure",
      area: "B&D",
      subarea: "Editorial",
      unit: null,
      status: "En revisión",
      description: "Diseño",
      deliverables: "PDF",
      exclusions: "",
      estimatedTime: "2 semanas",
      variants: [
        { tier: "START", min: 7, max: 8, currency: "UF", focus: null },
      ],
      history: { quoted: 2, approved: 1, lastAmounts: ["7 UF START"] },
    },
  ]);
  assert.match(text, /\[s1\] Brochure \(En revisión\)/);
  assert.match(text, /START 7–8 UF/);
  assert.match(text, /cotizado 2× \(aprobado 1×; últimos: 7 UF START\)/);
});

test("memoria y precedentes llevan ids para citarlos", () => {
  assert.match(
    renderLearnings([
      {
        id: "l1",
        kind: "precio",
        scope: "area",
        area: "WD",
        serviceName: null,
        clientName: null,
        industry: null,
        statement: "Regla",
      },
    ]),
    /\[l1\] \(Precio · área WD\) Regla/,
  );
  const p = renderPrecedents([
    {
      id: "p1",
      source: "historico",
      code: "N250101",
      clientName: "X",
      issuedOn: "2025-01-01",
      areas: ["B&D"],
      title: "T",
      summary: null,
      lines: [],
      totalUf: null,
      conditions: null,
      outcome: null,
      excerpt: "texto",
    },
  ]);
  assert.match(p, /\[p1\] N250101/);
  assert.match(p, /Extracto: texto/);
});

test("catálogo y memoria van en bloques cacheados; indicaciones del equipo al final", () => {
  const input = {
    catalog: [],
    learnings: [],
    precedents: [],
    team: [{ id: "m1", name: "Ana", role: "Dirección" }],
    client: {
      companyName: "Mueblería Andes",
      industry: null,
      website: null,
      status: "Prospecto",
      notes: null,
      contacts: [],
      history: [],
    },
    brief: {
      projectName: "P",
      mainArea: "B&D" as const,
      involvedAreas: [],
      fields: { problem: "Vender" },
      areaAnswers: {},
      suggestedServices: [],
    },
    today: "15-11-2026",
    ufClp: 41264.5,
    instructions: "Tope 40 UF",
  };
  const blocks = draftSystemBlocks(input);
  assert.equal(blocks[0].cache, undefined);
  assert.equal(blocks[1].cache, true);
  assert.equal(blocks[2].cache, true);
  const user = draftUserInput(input);
  assert.match(user, /\[m1\] Ana · Dirección/);
  assert.match(user, /INDICACIONES DEL EQUIPO[\s\S]*Tope 40 UF/);
});

test("términos de búsqueda sin stopwords y query segura", () => {
  const terms = searchTerms(
    "El cliente necesita un brochure para colegios; brochure en Canva. DROP TABLE",
  );
  assert.ok(terms.includes("brochure"));
  assert.ok(!terms.includes("cliente"));
  assert.equal(orTsQuery(["a'b", "c&d"]), "ab | cd");
  assert.equal(orTsQuery([]), null);
});

test("Claude por defecto; Opus para el borrador, Sonnet para el brief", () => {
  assert.equal(quoterAiConfig("draft", {}), null);
  const env = { ANTHROPIC_API_KEY: "x" };
  assert.deepEqual(quoterAiConfig("draft", env), {
    provider: "anthropic",
    model: "claude-opus-5-5",
    effort: "medium",
  });
  assert.equal(quoterAiConfig("brief", env)?.model, "claude-sonnet-5-5");
  assert.equal(
    quoterAiConfig("draft", { ...env, QUOTER_AI_PROVIDER: "off" }),
    null,
  );
  assert.equal(
    quoterAiConfig("draft", {
      QUOTER_AI_PROVIDER: "openai",
      OPENAI_API_KEY: "y",
    })?.provider,
    "openai",
  );
});
