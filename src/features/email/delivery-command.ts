/**
 * Comando de entrega en comentarios de Asana: `ENTREGA 01` (en MAYÚSCULAS,
 * número 1–999) al inicio del comentario + link(s). Las mayúsculas son el
 * gatillo explícito: "Entrega 2 queda para mañana…" es conversación interna y
 * nunca sale al cliente. Los links internos de Asana (menciones, tareas) no
 * se envían. Módulo puro.
 */

export const DELIVERY_COMMAND_RE =
  /^\s*ENTREGA\s*0*(\d{1,3})(?=$|[\s:·\-–—.,;])/;

/** Links que nunca se mandan al cliente (menciones y tareas de Asana). */
export function isInternalLink(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "asana.com" || host.endsWith(".asana.com");
  } catch {
    return true;
  }
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

export type DeliveryCommand = {
  round: number;
  links: string[];
  note: string | null;
};

function cleanUrl(url: string) {
  return url.replace(/[.,;:!?»”]+$/, "");
}

export function extractUrls(...sources: (string | null | undefined)[]) {
  const links: string[] = [];
  for (const source of sources) {
    if (!source) continue;
    const hrefs = [...source.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);
    const plain = source.match(URL_RE) ?? [];
    for (const raw of [...hrefs, ...plain]) {
      const url = cleanUrl(raw.replace(/&amp;/g, "&"));
      if (
        /^https?:\/\//i.test(url) &&
        !isInternalLink(url) &&
        !links.includes(url)
      ) {
        links.push(url);
      }
    }
  }
  return links;
}

/**
 * Interpreta un comentario. Devuelve null si no es una entrega.
 * `htmlText` (html_text de Asana) aporta los href de links con texto.
 */
export function parseDeliveryCommand(
  text: string | null | undefined,
  htmlText?: string | null,
): DeliveryCommand | null {
  const match = text?.match(DELIVERY_COMMAND_RE);
  if (!text || !match) return null;
  const round = Number(match[1]);
  if (!Number.isInteger(round) || round < 1) return null;

  const links = extractUrls(text, htmlText);
  const note = text
    .slice(match[0].length)
    .replace(URL_RE, "")
    .replace(/^[\s:·\-–—.]+/, "")
    .split("\n")
    .map((line) => line.replace(/^[\s\-–—•*]+$/, "").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { round, links, note: note || null };
}

export function formatRound(round: number) {
  return String(round).padStart(2, "0");
}
