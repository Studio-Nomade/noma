/**
 * Prompts del cotizador con IA (partes puras, sin `server-only`, para testear).
 *
 * El método es genérico y vive en el repo. Lo específico del estudio (valores,
 * descuentos, condiciones reales, criterios de Sebastián) llega desde la base:
 * catálogo, precedentes y memoria (`quoter_learnings`). Así el repo público no
 * guarda pricing real (ver AGENTS.md).
 */

import type { Area } from "@/types/enums";
import { AREA_LABELS, QUOTER_LEARNING_KIND_LABELS } from "@/types/enums";
import type { QuoterLearningKind, QuoterLearningScope } from "@/types/enums";
import { BRIEF_FIELDS_BY_AREA } from "@/features/briefs/fields";
import type { ClaudeSystemBlock } from "@/lib/ai/structured-body";

// ── Tipos de contexto (los arma `context.ts` desde la base) ──
export type CatalogVariant = {
  tier: string;
  min: number | null;
  max: number | null;
  currency: string;
  focus: string | null;
};

export type CatalogEntry = {
  id: string;
  name: string;
  area: Area;
  subarea: string | null;
  unit: string | null;
  status: string;
  description: string;
  deliverables: string;
  exclusions: string;
  estimatedTime: string | null;
  variants: CatalogVariant[];
  /** Valores efectivamente cotizados en propuestas enviadas/aprobadas. */
  history: { quoted: number; approved: number; lastAmounts: string[] } | null;
};

export type LearningEntry = {
  id: string;
  kind: QuoterLearningKind;
  scope: QuoterLearningScope;
  area: Area | null;
  serviceName: string | null;
  clientName: string | null;
  industry: string | null;
  statement: string;
};

export type PrecedentEntry = {
  id: string;
  source: "historico" | "noma";
  code: string | null;
  clientName: string | null;
  issuedOn: string | null;
  areas: string[];
  title: string | null;
  summary: string | null;
  lines: {
    name: string;
    amount: number | null;
    currency: string | null;
    unit?: string | null;
    quantity?: number | null;
    note?: string | null;
  }[];
  totalUf: number | null;
  conditions: string | null;
  outcome: string | null;
  excerpt: string | null;
};

export type ClientEntry = {
  companyName: string;
  industry: string | null;
  website: string | null;
  status: string;
  notes: string | null;
  contacts: { name: string | null; role: string | null }[];
  history: { title: string; status: string; date: string }[];
};

export type TeamEntry = { id: string; name: string; role: string | null };

export type BriefEntry = {
  projectName: string;
  mainArea: Area;
  involvedAreas: Area[];
  fields: Record<string, string>;
  areaAnswers: Record<string, Record<string, string>>;
  suggestedServices: string[];
};

const clip = (value: string | null | undefined, max: number) => {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const money = (amount: number | null, currency: string | null) =>
  amount == null ? "s/v" : `${formatNumber(amount)} ${currency ?? "UF"}`;

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

// ── Método (estable, cacheable) ──────────────────────────────
export const QUOTER_METHOD = `Eres el cotizador de Studio Nomade, estudio creativo chileno (áreas: ${Object.entries(
  AREA_LABELS,
)
  .map(([key, label]) => `${key} = ${label}`)
  .join("; ")}).

Tu trabajo: con el brief aprobado de una reunión de diagnóstico, armar el borrador de una propuesta comercial lista para que el equipo la revise y envíe. Escribes en español de Chile, claro y sin relleno.

Método (síguelo en orden):
1. Entiende el negocio del cliente y el problema de fondo. La propuesta resuelve ese problema, no solo lista lo que pidió.
2. Usa primero servicios del CATÁLOGO. Elige el nivel (tier) según el tamaño real del trabajo. Si un servicio del catálogo calza tal cual, va como "catalogo" con su id.
3. Si nada calza, o calza solo con ajustes de alcance, crea un servicio "personalizado" con ficha completa (descripción, metodología por etapas, entregables, exclusiones, plazo, unidad). Indica en based_on_service_id el servicio del que es ajuste. No fuerces un servicio genérico que describe otro trabajo (otra herramienta, otro formato, otra escala).
4. Valor de cada línea:
   - Parte del rango del catálogo y de los PRECEDENTES (valores reales ya cotizados). Cita en rationale los precedentes que usas con su valor.
   - Si es personalizado o ajustas el valor, explica la derivación: días o jornadas de trabajo por rol y el valor por unidad que resulta; compáralo con servicios parecidos.
   - Respeta la MEMORIA: son reglas del estudio aprendidas de propuestas anteriores. Si aplicas una, pon su id en applied_learning_ids. Si una regla contradice el catálogo, gana la regla.
   - unit_price es por unidad; quantity multiplica. Usa null solo si el valor del catálogo (mínimo del tier) es exactamente el que propones.
5. Servicios recurrentes (mensual, por pieza, por hora) llevan su unidad y no se mezclan con el total de los servicios únicos: si son opcionales o por demanda, descríbelos en commercial_conditions en vez de agregarlos como línea.
6. Alcance con topes explícitos: rondas de ajustes, sesiones, jornadas, piezas. Lo que no está incluido va en exclusiones (implementación de terceros, licencias, producción no considerada, etc.).
7. Descuento solo si hay razón comercial clara (por ejemplo, contratar varios servicios juntos) y según la memoria. No inventes descuentos.
8. Secciones del documento: párrafos cortos (2–3 oraciones), **negrita** para lo clave, viñetas con "• " y subtítulos "01 · Título:" cuando hay varios puntos. Sin promesas que el estudio no controla.
9. Lo que el brief no resuelve y afecta el valor o el alcance va a open_questions como pregunta concreta. No lo inventes.
10. team: elige del EQUIPO DISPONIBLE a quienes trabajarán en esta propuesta (según la memoria y las áreas), con su rol en el proyecto.
11. summary_for_team: dile al equipo en pocas líneas qué propones, el total aproximado y qué revisar antes de enviar.

Valores en UF + IVA salvo que el catálogo use otra moneda. No incluyas IVA en los valores.`;

export function renderCatalog(catalog: CatalogEntry[]): string {
  if (!catalog.length) return "CATÁLOGO: (vacío)";
  const byArea = new Map<string, CatalogEntry[]>();
  for (const entry of catalog) {
    const list = byArea.get(entry.area) ?? [];
    list.push(entry);
    byArea.set(entry.area, list);
  }
  const lines: string[] = [
    "CATÁLOGO DE SERVICIOS (id · nombre · subárea · unidad · niveles con rango de valor · historial):",
  ];
  for (const [area, entries] of byArea) {
    lines.push(`\n## ${area} · ${AREA_LABELS[area as Area] ?? area}`);
    for (const e of entries) {
      const tiers = e.variants
        .map(
          (v) =>
            `${v.tier} ${v.min == null ? "s/v" : formatNumber(v.min)}${
              v.max != null && v.max !== v.min ? `–${formatNumber(v.max)}` : ""
            } ${v.currency}${v.focus ? ` (${clip(v.focus, 60)})` : ""}`,
        )
        .join(" | ");
      const history = e.history
        ? ` · cotizado ${e.history.quoted}× (aprobado ${e.history.approved}×${
            e.history.lastAmounts.length
              ? `; últimos: ${e.history.lastAmounts.join(", ")}`
              : ""
          })`
        : "";
      lines.push(
        `- [${e.id}] ${e.name}${e.status !== "Activo" ? ` (${e.status})` : ""} · ${
          e.subarea ?? "—"
        } · ${e.unit ?? "Único"} · ${tiers || "sin valor"}${history}`,
      );
      const desc = clip(e.description, 220);
      if (desc) lines.push(`  ${desc}`);
      const deliverables = clip(e.deliverables, 200);
      if (deliverables) lines.push(`  Entrega: ${deliverables}`);
      const exclusions = clip(e.exclusions, 160);
      if (exclusions) lines.push(`  No incluye: ${exclusions}`);
      if (e.estimatedTime) lines.push(`  Plazo: ${clip(e.estimatedTime, 60)}`);
    }
  }
  return lines.join("\n");
}

export function renderLearnings(learnings: LearningEntry[]): string {
  if (!learnings.length) {
    return "MEMORIA DEL COTIZADOR: aún no hay reglas aprendidas.";
  }
  const lines = [
    "MEMORIA DEL COTIZADOR (reglas del estudio aprendidas de propuestas anteriores; aplícalas):",
  ];
  for (const l of learnings) {
    const scope =
      l.scope === "global"
        ? "general"
        : l.scope === "area"
          ? `área ${l.area ?? "?"}`
          : l.scope === "servicio"
            ? `servicio ${l.serviceName ?? "?"}`
            : l.scope === "cliente"
              ? `cliente ${l.clientName ?? "?"}`
              : `rubro ${l.industry ?? "?"}`;
    lines.push(
      `- [${l.id}] (${QUOTER_LEARNING_KIND_LABELS[l.kind]} · ${scope}) ${clip(l.statement, 400)}`,
    );
  }
  return lines.join("\n");
}

export function renderPrecedents(precedents: PrecedentEntry[]): string {
  if (!precedents.length) return "PRECEDENTES: no hay casos parecidos.";
  const lines = [
    "PRECEDENTES (propuestas reales parecidas, con sus valores; úsalos como referencia de alcance y precio):",
  ];
  for (const p of precedents) {
    lines.push(
      `\n### [${p.id}] ${p.code ?? "s/código"} · ${p.clientName ?? "cliente s/n"} · ${
        p.issuedOn ?? "s/fecha"
      } · ${p.areas.join("+") || "—"}${p.outcome ? ` · ${p.outcome}` : ""}${
        p.source === "historico" ? " · PDF histórico" : " · Noma"
      }`,
    );
    if (p.title) lines.push(`Título: ${clip(p.title, 140)}`);
    if (p.summary) lines.push(`Resumen: ${clip(p.summary, 500)}`);
    for (const line of p.lines.slice(0, 12)) {
      lines.push(
        `• ${clip(line.name, 90)}: ${money(line.amount, line.currency)}${
          line.quantity && line.quantity > 1 ? ` × ${line.quantity}` : ""
        }${line.unit ? ` (${line.unit})` : ""}${line.note ? ` — ${clip(line.note, 140)}` : ""}`,
      );
    }
    if (p.totalUf != null)
      lines.push(`Total neto: ${formatNumber(p.totalUf)} UF`);
    if (p.conditions) lines.push(`Condiciones: ${clip(p.conditions, 300)}`);
    if (!p.summary && !p.lines.length && p.excerpt) {
      lines.push(`Extracto: ${clip(p.excerpt, 1_200)}`);
    }
  }
  return lines.join("\n");
}

export function renderBrief(brief: BriefEntry): string {
  const labels: Record<string, string> = {
    contextGeneral: "Contexto",
    problem: "Problema / necesidad",
    mainObjective: "Objetivo principal",
    expectedOutcome: "Resultado esperado",
    targetAudience: "Público objetivo",
    idealDeadline: "Plazo ideal",
    budgetMentioned: "Presupuesto mencionado",
    decisionMakers: "Decisores",
    urgency: "Urgencia",
    restrictions: "Restricciones",
    availableMaterials: "Material disponible",
    pendingInfo: "Información pendiente",
    generalComments: "Comentarios",
    commercialRecs: "Recomendación comercial",
    risks: "Riesgos",
  };
  const lines = [
    `BRIEF APROBADO · ${brief.projectName}`,
    `Área principal: ${brief.mainArea} · Involucradas: ${
      brief.involvedAreas.join(", ") || "—"
    }`,
  ];
  for (const [key, label] of Object.entries(labels)) {
    const value = brief.fields[key]?.trim();
    if (value) lines.push(`${label}: ${clip(value, 1_500)}`);
  }
  for (const [area, answers] of Object.entries(brief.areaAnswers)) {
    const fields = BRIEF_FIELDS_BY_AREA[area as Area] ?? [];
    const answered = fields
      .filter((f) => answers[f.key]?.trim())
      .map((f) => `- ${f.label} ${clip(answers[f.key], 400)}`);
    if (answered.length) lines.push(`\nBrief ${area}:`, ...answered);
  }
  if (brief.suggestedServices.length) {
    lines.push(
      `\nServicios sugeridos en el brief: ${brief.suggestedServices.join("; ")}`,
    );
  }
  return lines.join("\n");
}

export function renderClient(client: ClientEntry): string {
  const lines = [
    `CLIENTE: ${client.companyName} (${client.status})`,
    client.industry ? `Rubro: ${client.industry}` : "",
    client.website ? `Web: ${client.website}` : "",
    client.notes ? `Notas: ${clip(client.notes, 600)}` : "",
    client.contacts.length
      ? `Contactos: ${client.contacts
          .map((c) => [c.name, c.role].filter(Boolean).join(" · "))
          .join("; ")}`
      : "",
    client.history.length
      ? `Historial con el estudio: ${client.history
          .map((h) => `${h.title} (${h.status}, ${h.date})`)
          .join("; ")}`
      : "Cliente nuevo para el estudio.",
  ];
  return lines.filter(Boolean).join("\n");
}

export function renderTeam(team: TeamEntry[]): string {
  if (!team.length) return "";
  return `EQUIPO DISPONIBLE (id · nombre · cargo):\n${team
    .map((m) => `- [${m.id}] ${m.name}${m.role ? ` · ${m.role}` : ""}`)
    .join("\n")}`;
}

export type DraftPromptInput = {
  catalog: CatalogEntry[];
  learnings: LearningEntry[];
  precedents: PrecedentEntry[];
  client: ClientEntry;
  brief: BriefEntry;
  team: TeamEntry[];
  today: string;
  ufClp: number | null;
  instructions?: string | null;
};

/** System en 3 bloques: método y catálogo (cacheados) + memoria. */
export function draftSystemBlocks(
  input: DraftPromptInput,
): ClaudeSystemBlock[] {
  return [
    { text: QUOTER_METHOD },
    { text: renderCatalog(input.catalog), cache: true },
    { text: renderLearnings(input.learnings), cache: true },
  ];
}

export function draftUserInput(input: DraftPromptInput): string {
  return [
    `Fecha de hoy: ${input.today}${
      input.ufClp
        ? ` · UF del día: $${Math.round(input.ufClp).toLocaleString("es-CL")}`
        : ""
    }`,
    renderClient(input.client),
    renderBrief(input.brief),
    renderTeam(input.team),
    renderPrecedents(input.precedents),
    input.instructions?.trim()
      ? `INDICACIONES DEL EQUIPO PARA ESTA PROPUESTA (prioridad sobre todo lo demás):\n${input.instructions.trim()}`
      : "",
    "Arma el borrador de la propuesta.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── Notas → brief ────────────────────────────────────────────
export function briefSystemPrompt(areas: Area[]): string {
  const questions = areas
    .map((area) => {
      const fields = BRIEF_FIELDS_BY_AREA[area] ?? [];
      return `${area}:\n${fields.map((f) => `- ${f.key}: ${f.label}`).join("\n")}`;
    })
    .join("\n\n");
  return `Eres el asistente comercial de Studio Nomade (estudio creativo chileno). Lees las notas o la transcripción de una reunión de diagnóstico con un cliente (máx. 30 min) y armas el brief.

Reglas:
- Usa solo lo que dicen las notas. Lo que no está, queda vacío ('' o null) y, si importa para cotizar, va a "pending" como pregunta concreta para el cliente.
- Distingue al equipo de Studio Nomade (Ana, Sebastián, Javiera, Catalina y otros con correo @studionomade.cl) de las personas del cliente: en "contacts" van solo las del cliente.
- "answered": responde las preguntas del brief del área usando su clave (key). Solo las que las notas responden.
- "suggested_service_ids": solo ids que aparecen en el CATÁLOGO.
- Español de Chile, frases claras, sin relleno.

Preguntas del brief por área:
${questions}`;
}

export function learningKindLabel(kind: QuoterLearningKind) {
  return QUOTER_LEARNING_KIND_LABELS[kind];
}
