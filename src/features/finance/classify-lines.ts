import type { Area } from "@/types/enums";
import type { DteLine } from "./import/dte-xml";

/**
 * Clasificación de un documento a partir de su detalle (líneas del XML).
 *
 * Nubox solo entrega montos; el detalle del DTE tiene los nombres de ítem
 * ("Web Design …", "Branding …") que permiten deducir la **línea de negocio**
 * (área) y sugerir un **servicio** del catálogo. Es una sugerencia editable.
 */

// Palabras clave por área (orden = prioridad si hay empate).
const AREA_HINTS: [Area, RegExp][] = [
  ["WD", /web\s*design|desarrollo\s*web|plataforma\s*web|landing|ecommerce|sitio\s*web|\bweb\b|wordpress|webflow/i],
  ["B&D", /branding|identidad|marca|\blogo\b|naming|packaging|manual\s*de\s*marca|papeler[ií]a|editorial/i],
  ["A&A", /audiovisual|\bvideo\b|animaci[oó]n|motion|\bspot\b|\breel|fotograf|locuci/i],
  ["A&D", /arquitect|interiorismo|\bstand\b|render|3d|mobiliario|se[nñ]al[eé]tica/i],
  ["CSM", /content|social\s*media|\brrss\b|redes\s*sociales|community|contenido|reels|pauta|\bads\b/i],
  ["STR", /strateg|consultor[ií]a|estrateg|workshop|diagn[oó]stico|asesor[ií]a\s*estrat/i],
  ["CE", /cl[ií]nica|emprendim/i],
  ["MP", /mercado\s*p[uú]blico|licitaci[oó]n/i],
];

export type LineClassification = {
  areaCode: Area | null;
  serviceId: string | null;
};

export type ServiceRef = { id: string; name: string; area: Area };

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Área dominante del documento, ponderada por el monto de cada línea. */
export function detectArea(lines: DteLine[]): Area | null {
  const score = new Map<Area, number>();
  for (const l of lines) {
    const text = `${l.nombre} ${l.descripcion ?? ""}`;
    for (const [area, re] of AREA_HINTS) {
      if (re.test(text)) {
        score.set(area, (score.get(area) ?? 0) + (l.monto || 1));
        break; // primera coincidencia por prioridad
      }
    }
  }
  let best: Area | null = null;
  let max = 0;
  for (const [area, s] of score) {
    if (s > max) {
      max = s;
      best = area;
    }
  }
  return best;
}

/** Mejor servicio del catálogo (misma área) por solape de palabras del nombre. */
export function matchService(
  lines: DteLine[],
  area: Area | null,
  services: ServiceRef[],
): string | null {
  if (!area) return null;
  const pool = services.filter((s) => s.area === area);
  if (!pool.length) return null;

  const itemTokens = new Set(
    lines
      .flatMap((l) => fold(l.nombre).split(/[^a-z0-9]+/))
      .filter((w) => w.length > 3),
  );
  if (!itemTokens.size) return null;

  let bestId: string | null = null;
  let bestScore = 0;
  for (const svc of pool) {
    const svcTokens = fold(svc.name).split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const overlap = svcTokens.filter((t) => itemTokens.has(t)).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      bestId = svc.id;
    }
  }
  return bestScore > 0 ? bestId : null;
}
