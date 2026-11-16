import { test } from "node:test";
import assert from "node:assert/strict";
import { clientPatchFromBrief, mapBriefAi } from "./brief-map";
import type { BriefAiOutput } from "./schema";

const output: BriefAiOutput = {
  executive_summary: "Resumen",
  client_context: "Contexto",
  explicit_need: "Necesita brochure",
  implicit_need: "",
  core_problem: "Problema",
  objectives: ["Vender más", " "],
  target_audience: "Colegios",
  main_area: "B&D",
  involved_areas: [],
  requested_services: ["brochure"],
  suggested_service_ids: ["s1", "zz"],
  answered: [
    { area: "B&D", key: "has_name", answer: "Sí, Andes" },
    { area: "B&D", key: "no-existe", answer: "x" },
  ],
  pending: [
    { area: "B&D", question: "¿Tienen fotos?" },
    { area: null, question: "¿Quién aprueba?" },
  ],
  deadlines: "",
  budget: "30 UF",
  decision_makers: "El dueño",
  risks: [],
  next_steps: ["Enviar propuesta"],
  commercial_recommendation: "Pack",
  close_probability: 140,
  client_profile: {
    industry: "Mobiliario escolar",
    website: "andes.cl",
    instagram: null,
    linkedin: null,
    comuna: "No se menciona",
    region: null,
    rut: null,
    legal_name: null,
    notes: null,
  },
  contacts: [],
};

test("mapea respuestas por clave, pendientes y servicios sugeridos", () => {
  const x = mapBriefAi(output, {
    mainArea: "B&D",
    involvedAreas: [],
    catalogNames: new Map([["s1", "Brochure Comercial"]]),
  });
  assert.equal(x.engine, "claude");
  assert.deepEqual(x.answeredByArea["B&D"], [
    { question: "¿Tiene nombre la marca? ¿Cuál?", answer: "Sí, Andes" },
  ]);
  assert.equal(x.pendingByArea["B&D"][0], "¿Tienen fotos?");
  assert.deepEqual(x.pendingByArea.General, ["¿Quién aprueba?"]);
  assert.deepEqual(x.suggestedServices, ["Brochure Comercial"]);
  assert.deepEqual(x.objectives, ["Vender más"]);
  assert.equal(x.closeProbability, 100);
});

test("la ficha del cliente solo completa campos vacíos", () => {
  const patch = clientPatchFromBrief(output.client_profile, {
    industry: null,
    website: "https://andes.cl",
    instagram: null,
    linkedin: null,
    comuna: null,
    region: null,
    rut: null,
    legalName: null,
  });
  assert.deepEqual(patch, { industry: "Mobiliario escolar" });
});
