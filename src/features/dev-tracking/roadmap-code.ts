/**
 * Clave común del seguimiento de desarrollo: el código de roadmap.
 * Mejoras y correcciones: `R74`. Módulos nuevos: `NDes-006`. Dentro de un
 * roadmap, los hitos van como `H5` (o `H0.3`, `I1.7`).
 */
const CODE_RE = /\b(NDes-\d{3}|R\d{2,3})\b/i;
const MILESTONE_RE = /\b([HI]\d{1,2}(?:\.\d{1,2})?)\b/;

export function normalizeRoadmapCode(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (upper.startsWith("NDES-")) return `NDes-${upper.slice(5)}`;
  return upper;
}

/** Detecta el código de roadmap en un título de PR, una rama o un nombre de tarea. */
export function detectRoadmapCode(
  text: string | null | undefined,
): string | null {
  if (!text) return null;
  const branch = text.match(/\b(?:feat|fix|chore)\/(r\d{2,3}|ndes-\d{3})\b/i);
  if (branch) return normalizeRoadmapCode(branch[1]);
  const m = text.match(CODE_RE);
  return m ? normalizeRoadmapCode(m[1]) : null;
}

/** Detecta el hito (`H2`, `H0.3`) en un título o rama. */
export function detectMilestone(
  text: string | null | undefined,
): string | null {
  if (!text) return null;
  const branch = text.match(
    /\b(?:feat|fix)\/(?:r\d{2,3}|ndes-\d{3})-(h\d{1,2}(?:\.\d{1,2})?)\b/i,
  );
  if (branch) return branch[1].toUpperCase();
  const m = text.match(MILESTONE_RE);
  return m ? m[1].toUpperCase() : null;
}

export function isPromotion(
  base: string,
  head: string | null | undefined,
  title: string,
) {
  if (base !== "main") return false;
  if (head && /^promote\//i.test(head)) return true;
  return /^promoci[oó]n\b/i.test(title.trim());
}

/** Orden natural: NDes-001 < NDes-002 … después R16 < R17 … */
export function compareRoadmapCodes(a: string, b: string) {
  const ka = codeKey(a);
  const kb = codeKey(b);
  if (ka.group !== kb.group) return ka.group - kb.group;
  return ka.n - kb.n;
}

function codeKey(code: string) {
  const c = normalizeRoadmapCode(code);
  if (c.startsWith("NDes-")) return { group: 0, n: Number(c.slice(5)) || 0 };
  if (c.startsWith("R")) return { group: 1, n: Number(c.slice(1)) || 0 };
  return { group: 2, n: 0 };
}

/** «2026-11» a partir de una fecha ISO. */
export function monthOf(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
