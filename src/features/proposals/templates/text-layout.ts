/**
 * Maquetación de los textos libres de la propuesta (contexto, objetivo,
 * alcance, condiciones, exclusiones, descripción de servicios).
 *
 * Convierte texto plano en bloques (subtítulo / párrafo / viñeta) para que el
 * deck y el PDF los rendericen con jerarquía y aire, y los pagina cuando no
 * caben en una lámina. Reglas que entiende:
 *
 * - Líneas en blanco separan párrafos.
 * - `**negrita**` dentro de una línea.
 * - `- `, `• ` o `* ` al inicio → viñeta.
 * - `01 · Título: texto` o `Título: texto` (etiqueta corta) → subtítulo + párrafo.
 * - Línea corta que termina en `:` → subtítulo.
 * - Un párrafo muy largo sin saltos se reparte en párrafos de dos oraciones.
 */

export type TextRun = { text: string; bold: boolean };

export type TextBlock = {
  kind: "heading" | "paragraph" | "bullet";
  runs: TextRun[];
};

const LABEL_PATTERN = /^((?:\d{1,2}\s*[·.)\-–]\s*)?[^:.;]{3,60}):\s+(\S.*)$/;
const NUMBERED_PATTERN = /^\d{1,2}\s*[·.)\-–]\s*/;
const BULLET_PATTERN = /^[-•*]\s+(.*)$/;
const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9"“(])/;

export function parseInlineRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      runs.push({ text: part.slice(2, -2), bold: true });
    } else {
      runs.push({ text: part, bold: false });
    }
  }
  return runs.length ? runs : [{ text, bold: false }];
}

function plain(runs: TextRun[]): string {
  return runs.map((run) => run.text).join("");
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("es-CL") + text.slice(1);
}

function isLabel(label: string): boolean {
  if (NUMBERED_PATTERN.test(label)) return true;
  const words = label.trim().split(/\s+/).length;
  return label.length <= 42 && words <= 6;
}

/**
 * "Lead: a; b; c" o "a; b; c" → párrafo de entrada (opcional) + viñetas.
 * Se usa cuando una línea enumera tres o más elementos con punto y coma.
 */
function semicolonList(
  text: string,
): { lead: string | null; items: string[] } | null {
  const parts = text
    .split(/;\s+/)
    .map((part) => part.trim().replace(/[.;]$/, ""))
    .filter(Boolean);
  if (parts.length < 3) return null;
  const colon = parts[0].indexOf(": ");
  if (colon > 0 && colon <= 80) {
    const lead = parts[0].slice(0, colon + 1);
    return { lead, items: [parts[0].slice(colon + 2), ...parts.slice(1)] };
  }
  return { lead: null, items: parts };
}

function splitLongParagraph(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const sentences = text.split(SENTENCE_SPLIT).filter(Boolean);
  if (sentences.length < 2) return [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    const sentencesInCurrent = current
      ? current.split(SENTENCE_SPLIT).length
      : 0;
    if (current && (candidate.length > maxChars || sentencesInCurrent >= 2)) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function pushBody(blocks: TextBlock[], text: string, maxChars: number) {
  const list = semicolonList(text);
  if (list) {
    if (list.lead) {
      blocks.push({ kind: "paragraph", runs: parseInlineRuns(list.lead) });
    }
    for (const item of list.items) {
      blocks.push({ kind: "bullet", runs: parseInlineRuns(capitalize(item)) });
    }
    return;
  }
  for (const chunk of splitLongParagraph(text, maxChars)) {
    blocks.push({ kind: "paragraph", runs: parseInlineRuns(chunk) });
  }
}

export type ParseTextOptions = {
  /** Largo a partir del cual un párrafo sin saltos se reparte en varios. */
  maxParagraphChars?: number;
  /** Destaca en negrita la primera oración cuando el texto no trae ninguna. */
  emphasizeLead?: boolean;
};

export function parseProposalText(
  value: string | null | undefined,
  options: ParseTextOptions = {},
): TextBlock[] {
  const { maxParagraphChars = 260, emphasizeLead = true } = options;
  const blocks: TextBlock[] = [];
  const lines = (value ?? "").replace(/\r/g, "").split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const bullet = line.match(BULLET_PATTERN);
    if (bullet) {
      blocks.push({ kind: "bullet", runs: parseInlineRuns(bullet[1]) });
      continue;
    }

    const boldOnly = line.match(/^\*\*(.+)\*\*$/);
    if (boldOnly) {
      blocks.push({
        kind: "heading",
        runs: [{ text: boldOnly[1], bold: true }],
      });
      continue;
    }

    if (line.length <= 70 && line.endsWith(":")) {
      blocks.push({
        kind: "heading",
        runs: [{ text: line.slice(0, -1), bold: true }],
      });
      continue;
    }

    const labelled = line.match(LABEL_PATTERN);
    if (labelled && isLabel(labelled[1])) {
      blocks.push({
        kind: "heading",
        runs: [{ text: labelled[1].trim(), bold: true }],
      });
      pushBody(blocks, capitalize(labelled[2]), maxParagraphChars);
      continue;
    }
    if (labelled && !semicolonList(line) && !line.includes("**")) {
      // "Frase larga: desarrollo" → la frase queda en negrita como entrada.
      blocks.push({
        kind: "paragraph",
        runs: [
          { text: `${labelled[1].trim()}:`, bold: true },
          { text: ` ${labelled[2]}`, bold: false },
        ],
      });
      continue;
    }

    pushBody(blocks, line, maxParagraphChars);
  }

  const hasBold = blocks.some(
    (block) => block.kind !== "heading" && block.runs.some((run) => run.bold),
  );
  const hasHeading = blocks.some((block) => block.kind === "heading");
  if (emphasizeLead && !hasBold && !hasHeading) {
    const first = blocks.find((block) => block.kind === "paragraph");
    if (first) {
      const text = plain(first.runs);
      const [lead, ...rest] = text.split(SENTENCE_SPLIT);
      if (lead && rest.length) {
        first.runs = [
          { text: lead, bold: true },
          { text: ` ${rest.join(" ")}`, bold: false },
        ];
      }
    }
  }

  return blocks;
}

/** Cualquier bloque con `kind` y `runs` (sirve para TextBlock y RichTextBlock). */
export type WeighableBlock = { kind: string; runs: TextRun[] };

/** Peso tipográfico aproximado en líneas, para paginar. */
export function textBlockWeight(
  block: WeighableBlock,
  charsPerLine = 58,
): number {
  const length = plain(block.runs).length;
  const lines = Math.max(1, Math.ceil(length / charsPerLine));
  if (block.kind === "heading") return lines + 1.3;
  if (block.kind === "bullet" || block.kind === "ordered") return lines + 0.5;
  return lines + 0.9;
}

export function textBlocksWeight(
  blocks: WeighableBlock[],
  charsPerLine = 58,
): number {
  return blocks.reduce(
    (sum, block) => sum + textBlockWeight(block, charsPerLine),
    0,
  );
}

/**
 * Reparte los bloques en páginas manteniendo cada subtítulo junto a su
 * primer párrafo. `maxWeight` es el presupuesto de líneas por página.
 */
export function paginateTextBlocks<T extends WeighableBlock>(
  blocks: T[],
  maxWeight = 17,
  charsPerLine = 58,
): T[][] {
  const pages: T[][] = [];
  let page: T[] = [];
  let weight = 0;
  const flush = () => {
    if (page.length) pages.push(page);
    page = [];
    weight = 0;
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    let unit = [block];
    if (block.kind === "heading" && blocks[index + 1]?.kind !== "heading") {
      unit = [block, blocks[index + 1]].filter(Boolean) as T[];
      index += unit.length - 1;
    }
    const unitWeight = textBlocksWeight(unit, charsPerLine);
    if (page.length && weight + unitWeight > maxWeight) flush();
    page.push(...unit);
    weight += unitWeight;
  }
  flush();
  return pages.length ? pages : [[]];
}

/** Agrupa páginas de `paginateTextBlocks` en columnas por lámina. */
export function paginateColumns<T extends WeighableBlock>(
  blocks: T[],
  columnCount: number,
  maxColumnWeight: number,
  charsPerLine: number,
): T[][][] {
  if (!blocks.length) return [];
  const columns = paginateTextBlocks(blocks, maxColumnWeight, charsPerLine);
  const pages: T[][][] = [];
  for (let index = 0; index < columns.length; index += columnCount) {
    pages.push(columns.slice(index, index + columnCount));
  }
  return pages;
}
