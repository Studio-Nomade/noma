/**
 * Comando de entrega en comentarios de Asana: `ENTREGA 01` (número 1–999) al
 * inicio del comentario + link(s). Dos formas:
 *   - En MAYÚSCULAS, siempre es el gatillo explícito.
 *   - En minúsculas o mixto («Entrega 01», «entrega 1:») solo si es la
 *     primera línea completa (nada más que el número y, opcional, «:») y el
 *     comentario trae al menos un link para el cliente. Así «Entrega 2 queda
 *     para mañana…» sigue siendo conversación interna y nunca sale.
 * Los links internos de Asana (menciones, tareas) no se envían. Módulo puro.
 */

export const DELIVERY_COMMAND_RE =
  /^\s*ENTREGA\s*0*(\d{1,3})(?=$|[\s:·\-–—.,;])/;

/** «Entrega 01» / «entrega 1:» como primera línea completa. */
const LOOSE_DELIVERY_LINE_RE = /^\s*entrega\s*0*(\d{1,3})\s*:?\s*(?:\n|$)/i;

function matchCommand(text: string, htmlText?: string | null) {
  const strict = text.match(DELIVERY_COMMAND_RE);
  if (strict) return strict;
  const loose = text.match(LOOSE_DELIVERY_LINE_RE);
  if (!loose) return null;
  return extractUrls(text, htmlText).length ? loose : null;
}

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

export type DeliveryCommandFile = {
  label: string;
  url: string;
  detail: string | null;
};

export type DeliveryCommand = {
  round: number;
  links: string[];
  /** Un archivo por link, con nombre (`Nombre: link`) y detalle entre (…). */
  files: DeliveryCommandFile[];
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
  if (!text) return null;
  const match = matchCommand(text, htmlText);
  if (!match) return null;
  const round = Number(match[1]);
  if (!Number.isInteger(round) || round < 1) return null;

  const links = extractUrls(text, htmlText);
  const body = text.slice(match[0].length);
  const anchorLabels = anchorTexts(htmlText);
  const files: DeliveryCommandFile[] = [];
  const noteLines: string[] = [];
  for (const rawLine of body.split("\n")) {
    const lineUrls = extractUrls(rawLine);
    if (!lineUrls.length) {
      noteLines.push(rawLine.replace(/^[\s\-–—•*]+$/, "").trimEnd());
      continue;
    }
    const firstUrl = rawLine.search(/https?:\/\//i);
    const after = rawLine
      .slice(firstUrl)
      .replace(URL_RE, " ")
      .replace(/\s+/g, " ")
      .replace(/^[\s,.;:·\-–—]+|[\s,.;:·\-–—]+$/g, "")
      .trim();
    if (after) noteLines.push(after);
    const before = rawLine
      .slice(0, firstUrl)
      .replace(/^[\s:·\-–—•*.]+/, "")
      .replace(/[\s:·\-–—]+$/, "")
      .trim();
    for (const url of lineUrls) {
      const parsed =
        splitLabel(before) ?? splitLabel(anchorLabels.get(url) ?? "");
      files.push({
        url,
        label: parsed?.label ?? fallbackLabel(url, files.length),
        detail: parsed?.detail ?? null,
      });
    }
  }
  // Links que venían solo en el HTML (texto enlazado sin URL visible).
  for (const url of links) {
    if (files.some((file) => file.url === url)) continue;
    const parsed = splitLabel(anchorLabels.get(url) ?? "");
    files.push({
      url,
      label: parsed?.label ?? fallbackLabel(url, files.length),
      detail: parsed?.detail ?? null,
    });
  }
  const note = noteLines
    .join("\n")
    .replace(/^[\s:·\-–—.]+/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { round, links, files, note: note || null };
}

const GENERIC_ANCHOR = /^(link|enlace|aqu[ií]|ac[aá]|ver|here|click|clic)$/i;

const HOST_LABELS: [RegExp, string][] = [
  [/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/, "Google Drive"],
  [/(^|\.)canva\.com$/, "Canva"],
  [/(^|\.)figma\.com$/, "Figma"],
  [/(^|\.)vimeo\.com$/, "Vimeo"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "YouTube"],
  [/(^|\.)wetransfer\.com$|(^|\.)we\.tl$/, "WeTransfer"],
  [/(^|\.)behance\.net$/, "Behance"],
];

/** Nombre para un link sin nombre: el servicio (Canva, Drive…) o `Archivo NN`. */
export function fallbackLabel(url: string, index: number) {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    // URL inválida: nombre genérico
  }
  const service = HOST_LABELS.find(([pattern]) => pattern.test(host))?.[1];
  return service ?? `Archivo ${String(index + 1).padStart(2, "0")}`;
}

/** `Video 16:9 (1:32, con subtítulos)` → label + detalle. */
function splitLabel(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean || /^https?:\/\//i.test(clean) || GENERIC_ANCHOR.test(clean)) {
    return null;
  }
  const detail = clean.match(/\(([^()]+)\)\s*$/);
  const label = (detail ? clean.slice(0, detail.index) : clean).trim();
  if (!label) return null;
  return { label: label.slice(0, 120), detail: detail?.[1].trim() ?? null };
}

/** Texto visible de cada <a href> en el html_text de Asana. */
function anchorTexts(htmlText: string | null | undefined) {
  const map = new Map<string, string>();
  if (!htmlText) return map;
  for (const match of htmlText.matchAll(
    /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const url = match[1].replace(/&amp;/g, "&");
    const label = match[2]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .trim();
    if (label && label !== url && !map.has(url)) map.set(url, label);
  }
  return map;
}

// ── CONSULTA ─────────────────────────────────────────────────
/**
 * `CONSULTA` (en MAYÚSCULAS) al inicio de un comentario de Asana: cada línea
 * siguiente es una pregunta para el cliente. `CONSULTA BLOQUEA` avisa que la
 * entrega depende de la respuesta. Un texto entre paréntesis al final de una
 * línea se muestra como ayuda bajo la pregunta. Módulo puro.
 */
export const CONSULTA_COMMAND_RE =
  /^\s*CONSULTA(\s+BLOQUEA)?(?=$|[\s:·\-–—.,;])/;

export type ConsultaCommand = {
  blocking: boolean;
  questions: { text: string; hint: string | null }[];
};

export function parseConsultaCommand(
  text: string | null | undefined,
): ConsultaCommand | null {
  const match = text?.match(CONSULTA_COMMAND_RE);
  if (!text || !match) return null;
  const questions = text
    .slice(match[0].length)
    .replace(/^[\s:·\-–—.]+/, "")
    .split("\n")
    .map((line) => line.replace(/^[\s\-–—•*\d.)]+/, "").trim())
    .filter(Boolean)
    .filter(
      (line) => !extractUrls(line).length || line.replace(URL_RE, "").trim(),
    )
    .slice(0, 8)
    .map((line) => {
      const hint = line.match(/\(([^()]+)\)\s*$/);
      return {
        text: (hint ? line.slice(0, hint.index) : line).trim(),
        hint: hint?.[1].trim() ?? null,
      };
    })
    .filter((question) => question.text);
  return { blocking: Boolean(match[1]), questions };
}

export function formatRound(round: number) {
  return String(round).padStart(2, "0");
}
