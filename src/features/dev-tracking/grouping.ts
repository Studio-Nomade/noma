import { z } from "zod";

/**
 * Agrupación de solicitudes aprobadas en entregas: un roadmap en curso, un
 * roadmap nuevo (`R##`, mejoras y correcciones), un módulo nuevo (`NDes-###`)
 * o «sin roadmap» (soporte, datos o algo que queda para más adelante). Un R##
 * agrupa varias solicitudes: es la unidad que se entrega, se nombra en Asana
 * («R76 · título») y se empaqueta para el arquitecto. Módulo puro.
 */

export const GROUP_KINDS = [
  "existente",
  "mejora",
  "modulo",
  "sin_roadmap",
] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  existente: "Roadmap en curso",
  mejora: "Roadmap nuevo (R##)",
  modulo: "Módulo nuevo (NDes-###)",
  sin_roadmap: "Sin roadmap",
};

export type GroupingItem = {
  id: string;
  code: string;
  title: string;
  detail: string | null;
  area: string | null;
  type: string | null;
  environment: string | null;
  priority: string;
  destination: string | null;
  roadmapCode: string | null;
};

/** Roadmaps y módulos abiertos a los que se puede sumar una solicitud. */
export type OpenTarget = { code: string; title: string; kind: string };

export type ProposedGroup = {
  key: string;
  kind: GroupKind;
  /** Solo en `existente`: el código al que se suma. */
  code: string | null;
  title: string;
  reason: string | null;
  itemIds: string[];
};

export const groupingOutputSchema = z.object({
  grupos: z
    .array(
      z.object({
        tipo: z.enum(GROUP_KINDS),
        codigo_existente: z
          .string()
          .optional()
          .describe(
            "Solo si tipo = existente: código de la lista (R74, NDes-006).",
          ),
        titulo: z
          .string()
          .describe(
            "Nombre corto de la entrega, en lenguaje de negocio (máx. 60 caracteres).",
          ),
        motivo: z
          .string()
          .optional()
          .describe("Una línea: por qué van juntas."),
        solicitudes: z
          .array(z.string())
          .min(1)
          .describe("Códigos de las solicitudes (OP-01, CO-03…)."),
      }),
    )
    .default([]),
});

export type GroupingOutput = z.infer<typeof groupingOutputSchema>;

export const GROUPING_SYSTEM_PROMPT = `Eres el asistente de operaciones de Studio Nomade. Recibes solicitudes ya aprobadas de un cliente sobre una plataforma que el estudio desarrolla, y la lista de roadmaps y módulos abiertos. Las agrupas en entregas.

Reglas:
1. Un grupo es una entrega que se desarrolla, prueba y despliega junta. Junta lo que toca la misma pantalla, flujo o área del sistema; no mezcles áreas distintas solo para tener menos grupos.
2. tipo «existente»: la solicitud continúa un roadmap o módulo abierto de la lista (mismo flujo, ajuste o pendiente de esa entrega). Usa su código exacto en codigo_existente.
3. tipo «mejora»: mejoras y correcciones sobre funciones que ya existen → roadmap nuevo R##.
4. tipo «modulo»: una capacidad nueva y grande (nueva sección, nuevo flujo completo, integración nueva) → módulo nuevo NDes-###. Úsalo con moderación.
5. tipo «sin_roadmap»: soporte operativo, carga o corrección de datos, configuración o dudas que no requieren desarrollo, y lo que la reunión dejó explícitamente para más adelante.
6. Un bug urgente (prioridad Crítica) puede ir solo en su propio grupo «mejora» para desplegarlo antes.
7. Cada solicitud va en exactamente un grupo. No inventes códigos de solicitud.
8. Títulos en español, de negocio, sin jerga técnica (nada de PR, ramas ni deploy).`;

export function groupingUserPrompt(input: {
  programName: string;
  items: GroupingItem[];
  open: OpenTarget[];
}) {
  const open = input.open.length
    ? input.open.map((o) => `- ${o.code} · ${o.title} (${o.kind})`).join("\n")
    : "- (ninguno)";
  const items = input.items
    .map((it) =>
      [
        `- ${it.code} · ${it.title}`,
        it.detail ? `  Detalle: ${it.detail.slice(0, 600)}` : null,
        `  Área: ${it.area ?? "—"} · Tipo: ${it.type ?? "—"} · Entorno: ${it.environment ?? "—"} · Prioridad: ${it.priority}`,
        it.destination || it.roadmapCode
          ? `  Sugerido en la minuta: ${[it.destination, it.roadmapCode].filter(Boolean).join(" · ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
  return [
    `Programa: ${input.programName}`,
    "",
    "Roadmaps y módulos abiertos:",
    open,
    "",
    "Solicitudes aprobadas por agrupar:",
    items,
  ].join("\n");
}

const NO_DEV_TYPES = new Set(["Soporte operativo", "Data / base de datos"]);

/**
 * Agrupación sin IA (respaldo): lo que la minuta ya asoció a un roadmap
 * abierto va a ese roadmap; «Nuevo desarrollo» por área → módulo nuevo;
 * soporte y datos → sin roadmap; el resto, un R## nuevo por área.
 */
export function fallbackGrouping(
  items: GroupingItem[],
  open: OpenTarget[],
): ProposedGroup[] {
  const openCodes = new Map(open.map((o) => [o.code.toUpperCase(), o]));
  const groups = new Map<string, ProposedGroup>();
  function push(
    key: string,
    base: Omit<ProposedGroup, "key" | "itemIds">,
    id: string,
  ) {
    const g = groups.get(key) ?? { key, ...base, itemIds: [] };
    g.itemIds.push(id);
    groups.set(key, g);
  }
  for (const it of items) {
    const area = it.area ?? "General";
    const target = it.roadmapCode
      ? openCodes.get(it.roadmapCode.toUpperCase())
      : null;
    if (target) {
      push(
        `existente:${target.code}`,
        {
          kind: "existente",
          code: target.code,
          title: target.title,
          reason: "Asociada en la minuta",
        },
        it.id,
      );
    } else if (it.type && NO_DEV_TYPES.has(it.type)) {
      push(
        "sin_roadmap",
        {
          kind: "sin_roadmap",
          code: null,
          title: "Soporte y datos",
          reason: null,
        },
        it.id,
      );
    } else if (it.type === "Nuevo desarrollo" || it.destination === "nuevo") {
      push(
        `modulo:${area}`,
        {
          kind: "modulo",
          code: null,
          title: `Nuevo desarrollo · ${area}`,
          reason: null,
        },
        it.id,
      );
    } else {
      push(
        `mejora:${area}`,
        {
          kind: "mejora",
          code: null,
          title: `Mejoras · ${area}`,
          reason: null,
        },
        it.id,
      );
    }
  }
  return [...groups.values()];
}

/**
 * Normaliza la salida de la IA: descarta códigos inexistentes, repetidos y
 * códigos «existente» que no están abiertos (pasan a «mejora»); lo que la IA
 * dejó fuera se agrupa con el respaldo.
 */
export function normalizeGrouping(
  output: GroupingOutput,
  items: GroupingItem[],
  open: OpenTarget[],
): ProposedGroup[] {
  const byCode = new Map(items.map((it) => [it.code.toUpperCase(), it]));
  const openCodes = new Map(open.map((o) => [o.code.toUpperCase(), o]));
  const used = new Set<string>();
  const groups: ProposedGroup[] = [];
  output.grupos.forEach((g, i) => {
    const ids: string[] = [];
    for (const raw of g.solicitudes) {
      const it = byCode.get(raw.trim().toUpperCase());
      if (it && !used.has(it.id)) {
        used.add(it.id);
        ids.push(it.id);
      }
    }
    if (!ids.length) return;
    let kind: GroupKind = g.tipo;
    let code: string | null = null;
    if (kind === "existente") {
      const target = g.codigo_existente
        ? openCodes.get(g.codigo_existente.trim().toUpperCase())
        : null;
      if (target) code = target.code;
      else kind = "mejora";
    }
    groups.push({
      key: `ia:${i}`,
      kind,
      code,
      title: g.titulo.trim().slice(0, 120) || "Sin título",
      reason: g.motivo?.trim() || null,
      itemIds: ids,
    });
  });
  const rest = items.filter((it) => !used.has(it.id));
  return rest.length ? [...groups, ...fallbackGrouping(rest, open)] : groups;
}

/** Orden de entrega dentro de un paquete: prioridad y luego orden original. */
export const PRIORITY_RANK: Record<string, number> = {
  Crítica: 0,
  Alta: 1,
  Media: 2,
  Normal: 3,
};
