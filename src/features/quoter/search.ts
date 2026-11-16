/**
 * Términos de búsqueda para precedentes (pura): palabras con contenido del
 * brief, sin stopwords, listas para `to_tsquery('spanish', 'a | b | c')`.
 */

const STOPWORDS = new Set(
  `para como pero porque cuando donde desde hasta sobre entre este esta estos estas
  esto ese esa esos esas aquel aquella tiene tienen tener hacer hace hacen quiere
  quieren necesita necesitan cliente clientes empresa marca proyecto propuesta
  servicio servicios studio nomade también ademas además muy más menos todo todos
  toda todas cada otro otra otros otras ellos ellas nuestro nuestra sus suyo puede
  pueden debe deben sería serian según sin con los las del una uno unos unas que
  qué cual cuál quien quién algo nada solo sólo bien mejor actual actualmente
  hoy mes meses año años semana semanas días día objetivo objetivos través forma
  manera parte tipo general nivel caso casos hay ser está están estar fue han`
    .split(/\s+/)
    .filter(Boolean),
);

export function searchTerms(text: string, max = 24): string[] {
  const counts = new Map<string, number>();
  const words = text
    .toLowerCase()
    .normalize("NFC")
    .split(/[^a-záéíóúñü0-9]+/i)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, max)
    .map(([word]) => word);
}

/** Query OR para Postgres; null si no hay términos útiles. */
export function orTsQuery(terms: string[]): string | null {
  const safe = terms
    .map((t) => t.replace(/[^a-záéíóúñü0-9]/gi, ""))
    .filter(Boolean);
  return safe.length ? safe.join(" | ") : null;
}
