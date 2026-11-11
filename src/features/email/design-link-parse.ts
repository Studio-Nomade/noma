/**
 * Ids de diseños de Canva en un correo: `canva.com/design/<id>/…` directo, o
 * links cortos `canva.link/<código>` que hay que resolver aparte. Módulo puro.
 */

const CANVA_DESIGN_RE =
  /https?:\/\/(?:www\.)?canva\.com\/design\/([A-Za-z0-9_-]{8,})/gi;
export const CANVA_SHORT_LINK_RE = /https?:\/\/canva\.link\/[A-Za-z0-9_-]+/gi;

/** Id del diseño en una URL de Canva, o null. */
export function canvaIdFromUrl(url: string): string | null {
  const match = url.match(
    /^https?:\/\/(?:www\.)?canva\.com\/design\/([A-Za-z0-9_-]{8,})/i,
  );
  return match ? match[1] : null;
}

export function extractCanvaDesignIds(texts: (string | null | undefined)[]) {
  const ids = new Set<string>();
  const shortLinks = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(CANVA_DESIGN_RE)) ids.add(match[1]);
    for (const match of text.matchAll(CANVA_SHORT_LINK_RE)) {
      shortLinks.add(match[0]);
    }
  }
  return { ids: [...ids], shortLinks: [...shortLinks] };
}
