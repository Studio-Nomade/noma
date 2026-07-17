import type { Area } from "@/types/enums";
import { AREA_LABELS } from "@/types/enums";
import { BRIEF_FIELDS_BY_AREA } from "@/features/briefs/fields";

/**
 * Contrato de extracción del brief (idéntico para mock y para el LLM real).
 * Cuando se conecte Anthropic Claude (Inc. B+), solo se reemplaza la
 * implementación de `processBriefNotes`; este tipo es el límite estable.
 */
export type BriefExtraction = {
  executiveSummary: string;
  clientContext: string;
  explicitNeed: string;
  implicitNeed: string;
  coreProblem: string;
  objectives: string[];
  targetAudience: string;
  requestedServices: string[];
  suggestedServices: string[];
  mainArea: Area;
  involvedAreas: Area[];
  // Preguntas del área respondidas / pendientes según las notas.
  answeredByArea: Record<string, { question: string; answer: string }[]>;
  pendingByArea: Record<string, string[]>;
  risks: string[];
  deadlines: string;
  budget: string;
  decisionMakers: string;
  nextSteps: string[];
  commercialRecommendation: string;
  closeProbability: number; // 0–100
  // Metadata: de dónde salió la extracción.
  engine: "mock" | "claude";
};

export type ProcessInput = {
  text: string;
  mainArea: Area;
  involvedAreas?: Area[];
};

// Palabras clave → servicios sugeridos por área (heurística del mock).
const SERVICE_HINTS: Partial<Record<Area, { kw: RegExp; service: string }[]>> = {
  "B&D": [
    { kw: /logo|identidad|marca/i, service: "Desarrollo de Identidad de Marca" },
    { kw: /manual/i, service: "Manual de Marca" },
    { kw: /naming|nombre/i, service: "Naming" },
    { kw: /packaging|envase/i, service: "Packaging" },
  ],
  WD: [
    { kw: /landing/i, service: "Landing Page" },
    { kw: /ecommerce|tienda|venta/i, service: "E-commerce" },
    { kw: /corporativ/i, service: "Web Corporativa" },
    { kw: /seo/i, service: "SEO básico" },
  ],
  "A&A": [
    { kw: /video|spot|comercial/i, service: "Video Corporativo" },
    { kw: /animaci|motion/i, service: "Animación / Motion Graphics" },
    { kw: /foto/i, service: "Fotografía" },
  ],
  CSM: [
    { kw: /rrss|redes|instagram|social/i, service: "Gestión de RRSS" },
    { kw: /pauta|ads|publicidad/i, service: "Pauta / Ads" },
    { kw: /contenido|grilla/i, service: "Grilla de Contenidos" },
  ],
};

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pick(text: string, patterns: RegExp[]): string {
  for (const s of sentences(text)) {
    if (patterns.some((p) => p.test(s))) return s;
  }
  return "";
}

/**
 * Procesa notas de reunión y devuelve la estructura del brief.
 *
 * IMPLEMENTACIÓN MOCK (determinista, sin llamadas externas). Extrae señales por
 * heurística de palabras clave sobre el texto para que el flujo sea demostrable.
 * No inventa precisión: los campos sin señal quedan vacíos o marcados pendientes.
 */
export async function processBriefNotes(
  input: ProcessInput,
): Promise<BriefExtraction> {
  const text = input.text.trim();
  const main = input.mainArea;
  const involved = input.involvedAreas ?? [];
  const s = sentences(text);

  const executiveSummary = s.slice(0, 2).join(" ") || text.slice(0, 240);
  const budget = pick(text, [/\$|uf|clp|presupuesto|budget|millon/i]);
  const deadlines = pick(text, [/plazo|semana|mes|fecha|urg|deadline|antes de/i]);
  const decisionMakers = pick(text, [/gerent|director|dueñ|socio|decide|jefe|ceo/i]);
  const targetAudience = pick(text, [/público|clientes|target|audiencia|segmento/i]);

  // Preguntas del área principal: respondidas vs pendientes (heurística).
  const answeredByArea: BriefExtraction["answeredByArea"] = {};
  const pendingByArea: BriefExtraction["pendingByArea"] = {};
  for (const area of [main, ...involved]) {
    const answered: { question: string; answer: string }[] = [];
    const pending: string[] = [];
    for (const f of BRIEF_FIELDS_BY_AREA[area]) {
      const kw = f.label
        .toLowerCase()
        .replace(/[¿?.,:]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 3);
      const hit = s.find((sent) =>
        kw.some((w) => sent.toLowerCase().includes(w)),
      );
      if (hit) answered.push({ question: f.label, answer: hit });
      else pending.push(f.label);
    }
    answeredByArea[area] = answered;
    pendingByArea[area] = pending;
  }

  // Servicios sugeridos por palabras clave.
  const suggested = new Set<string>();
  for (const area of [main, ...involved]) {
    for (const h of SERVICE_HINTS[area] ?? []) {
      if (h.kw.test(text)) suggested.add(h.service);
    }
  }

  // Probabilidad de cierre: señales de presupuesto/plazo/decisor suben el score.
  let prob = 30;
  if (budget) prob += 20;
  if (deadlines) prob += 15;
  if (decisionMakers) prob += 15;
  if (text.length > 600) prob += 10;
  prob = Math.min(prob, 90);

  const risks: string[] = [];
  if (!budget) risks.push("Presupuesto no mencionado en la reunión.");
  if (!deadlines) risks.push("Plazo no definido.");
  if (!decisionMakers) risks.push("Tomador de decisión no identificado.");

  return {
    engine: "mock",
    executiveSummary,
    clientContext: s[0] ?? "",
    explicitNeed: pick(text, [/necesit|quiere|busca|requiere/i]) || executiveSummary,
    implicitNeed: "",
    coreProblem: pick(text, [/problema|dolor|dificultad|no logra/i]),
    objectives: s
      .filter((x) => /objetivo|lograr|meta|aumentar|mejorar|posicionar/i.test(x))
      .slice(0, 4),
    targetAudience,
    requestedServices: [...suggested],
    suggestedServices: [...suggested],
    mainArea: main,
    involvedAreas: involved,
    answeredByArea,
    pendingByArea,
    risks,
    deadlines,
    budget,
    decisionMakers,
    nextSteps: [
      "Confirmar información pendiente del brief.",
      `Preparar propuesta preliminar para ${AREA_LABELS[main]}.`,
    ],
    commercialRecommendation: budget
      ? "Oportunidad con señales claras; avanzar a propuesta."
      : "Levantar presupuesto y plazo antes de cotizar.",
    closeProbability: prob,
  };
}
