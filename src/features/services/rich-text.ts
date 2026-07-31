import { z } from "zod";
import {
  parseStructuredContent,
  type StructuredContentItem,
} from "@/features/proposals/structured-content";

const PREFIX = "noma-rich:v1:";
const MAX_STORAGE_LENGTH = 100_000;
const MAX_NODES = 1_000;
const ALLOWED_NODE_TYPES = new Set([
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "text",
  "hardBreak",
]);

export type RichTextRun = {
  text: string;
  bold: boolean;
};

export type RichTextBlock = {
  kind: "heading" | "paragraph" | "bullet" | "ordered";
  runs: RichTextRun[];
  level: number;
  ordinal?: number;
};

export type RichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string }[];
  text?: string;
  content?: RichTextNode[];
};

export type RichTextDocument = RichTextNode & {
  type: "doc";
};

const emptyDocument = (): RichTextDocument => ({
  type: "doc",
  content: [{ type: "paragraph" }],
});

function sanitizeNode(
  value: unknown,
  counter: { value: number },
): RichTextNode | null {
  if (!value || typeof value !== "object" || counter.value >= MAX_NODES) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const type = typeof candidate.type === "string" ? candidate.type : "";
  if (!ALLOWED_NODE_TYPES.has(type)) return null;
  counter.value += 1;

  if (type === "text") {
    const text =
      typeof candidate.text === "string"
        ? candidate.text.slice(0, MAX_STORAGE_LENGTH)
        : "";
    if (!text) return null;
    const hasBold =
      Array.isArray(candidate.marks) &&
      candidate.marks.some((mark) =>
        Boolean(
          mark &&
          typeof mark === "object" &&
          (mark as Record<string, unknown>).type === "bold",
        ),
      );
    return {
      type,
      text,
      ...(hasBold ? { marks: [{ type: "bold" }] } : {}),
    };
  }

  const content = Array.isArray(candidate.content)
    ? candidate.content
        .map((node) => sanitizeNode(node, counter))
        .filter((node): node is RichTextNode => Boolean(node))
    : [];
  const attrs: Record<string, unknown> = {};
  if (type === "heading") {
    const level = Number(
      (candidate.attrs as Record<string, unknown> | undefined)?.level,
    );
    attrs.level = level === 2 || level === 3 ? level : 3;
  }
  if (type === "orderedList") {
    const start = Number(
      (candidate.attrs as Record<string, unknown> | undefined)?.start,
    );
    attrs.start = Number.isInteger(start) && start > 0 ? start : 1;
  }
  return {
    type,
    ...(Object.keys(attrs).length ? { attrs } : {}),
    ...(content.length ? { content } : {}),
  };
}

function sanitizeDocument(value: unknown): RichTextDocument {
  const counter = { value: 0 };
  const node = sanitizeNode(value, counter);
  if (!node || node.type !== "doc") return emptyDocument();
  return {
    ...node,
    type: "doc",
    content: node.content?.length ? node.content : [{ type: "paragraph" }],
  };
}

function legacyItemsToDocument(
  items: StructuredContentItem[],
): RichTextDocument {
  const content: RichTextNode[] = [];
  for (const item of items) {
    if (item.title) {
      content.push({
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: item.title }],
      });
    }
    if (item.description) {
      content.push({
        type: "paragraph",
        content: [{ type: "text", text: item.description }],
      });
    }
  }
  return content.length ? { type: "doc", content } : emptyDocument();
}

export function parseRichTextDocument(
  value: string | null | undefined,
  legacyMode: "stages" | "deliverables",
): RichTextDocument {
  const raw = value?.trim();
  if (!raw) return emptyDocument();
  if (raw.startsWith(PREFIX)) {
    try {
      return sanitizeDocument(JSON.parse(raw.slice(PREFIX.length)));
    } catch {
      return emptyDocument();
    }
  }
  return legacyItemsToDocument(parseStructuredContent(raw, legacyMode));
}

export function serializeRichTextDocument(value: unknown): string {
  const document = sanitizeDocument(value);
  return isRichTextDocumentEmpty(document)
    ? ""
    : `${PREFIX}${JSON.stringify(document)}`;
}

export function normalizeRichTextStorage(
  value: string | null | undefined,
  legacyMode: "stages" | "deliverables",
): string {
  if (!value?.trim()) return "";
  return serializeRichTextDocument(parseRichTextDocument(value, legacyMode));
}

export function isRichTextDocumentEmpty(document: RichTextDocument): boolean {
  return !document.content?.some((node) => nodeText(node).trim());
}

export function isValidRichTextStorage(value: string): boolean {
  if (value.length > MAX_STORAGE_LENGTH) return false;
  if (!value.startsWith(PREFIX)) return true;
  try {
    const document = sanitizeDocument(JSON.parse(value.slice(PREFIX.length)));
    return document.type === "doc";
  } catch {
    return false;
  }
}

export const richTextStorageSchema = z
  .string()
  .max(MAX_STORAGE_LENGTH, "El contenido es demasiado extenso.")
  .refine(
    isValidRichTextStorage,
    "El contenido enriquecido es inválido o contiene formatos no permitidos.",
  );

function nodeRuns(node: RichTextNode): RichTextRun[] {
  if (node.type === "text" && node.text) {
    return [
      {
        text: node.text,
        bold: Boolean(node.marks?.some((mark) => mark.type === "bold")),
      },
    ];
  }
  if (node.type === "hardBreak") return [{ text: "\n", bold: false }];
  return (node.content ?? []).flatMap(nodeRuns);
}

function nodeText(node: RichTextNode): string {
  return nodeRuns(node)
    .map((run) => run.text)
    .join("");
}

function isBoldSubtitle(runs: RichTextRun[]): boolean {
  const visibleRuns = runs.filter((run) => run.text.trim());
  const length = visibleRuns.reduce((sum, run) => sum + run.text.length, 0);
  return (
    visibleRuns.length > 0 &&
    length <= 180 &&
    visibleRuns.every((run) => run.bold)
  );
}

function appendListBlocks(
  node: RichTextNode,
  blocks: RichTextBlock[],
  level: number,
  ordered: boolean,
) {
  let ordinal = Number(node.attrs?.start) || 1;
  for (const item of node.content ?? []) {
    if (item.type !== "listItem") continue;
    for (const child of item.content ?? []) {
      if (child.type === "paragraph" || child.type === "heading") {
        const runs = nodeRuns(child);
        if (runs.some((run) => run.text.trim())) {
          blocks.push({
            kind: ordered ? "ordered" : "bullet",
            runs,
            level,
            ...(ordered ? { ordinal } : {}),
          });
        }
      } else if (child.type === "bulletList" || child.type === "orderedList") {
        appendListBlocks(
          child,
          blocks,
          level + 1,
          child.type === "orderedList",
        );
      }
    }
    ordinal += 1;
  }
}

export function richTextBlocks(
  value: string | null | undefined,
  legacyMode: "stages" | "deliverables",
): RichTextBlock[] {
  const document = parseRichTextDocument(value, legacyMode);
  const blocks: RichTextBlock[] = [];
  for (const node of document.content ?? []) {
    if (node.type === "heading") {
      const runs = nodeRuns(node);
      if (runs.some((run) => run.text.trim())) {
        blocks.push({
          kind: "heading",
          runs,
          level: Number(node.attrs?.level) || 3,
        });
      }
    } else if (node.type === "paragraph") {
      const runs = nodeRuns(node);
      if (runs.some((run) => run.text.trim())) {
        const subtitle = isBoldSubtitle(runs);
        // El editor permite usar negrita para subtítulos. Los interpretamos
        // como encabezados semánticos para mantenerlos junto a su contenido
        // cuando el PDF distribuye una sección extensa entre columnas.
        blocks.push({
          kind: subtitle ? "heading" : "paragraph",
          runs,
          level: subtitle ? 3 : 0,
        });
      }
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      appendListBlocks(node, blocks, 0, node.type === "orderedList");
    }
  }
  return blocks;
}

function blockWeight(block: RichTextBlock): number {
  const length = block.runs.reduce((sum, run) => sum + run.text.length, 0);
  const lines = Math.max(1, Math.ceil(length / 78));
  if (block.kind === "heading") return 1.6 + lines * 0.7;
  if (block.kind === "paragraph") return 0.9 + lines;
  return 0.6 + lines * 0.8;
}

export function paginateRichTextBlocks(
  blocks: RichTextBlock[],
  maxWeight = 16,
): RichTextBlock[][] {
  const groups: RichTextBlock[][] = [];
  for (const block of blocks) {
    if (block.kind === "heading" || groups.length === 0) {
      groups.push([block]);
    } else {
      groups.at(-1)!.push(block);
    }
  }

  const pages: RichTextBlock[][] = [];
  let page: RichTextBlock[] = [];
  let weight = 0;

  const flush = () => {
    if (page.length) pages.push(page);
    page = [];
    weight = 0;
  };

  for (const group of groups) {
    const groupWeight = group.reduce(
      (sum, block) => sum + blockWeight(block),
      0,
    );
    if (groupWeight <= maxWeight) {
      if (page.length && weight + groupWeight > maxWeight) flush();
      page.push(...group);
      weight += groupWeight;
      continue;
    }

    if (page.length) flush();
    const heading = group[0]?.kind === "heading" ? group[0] : null;
    for (const block of group) {
      const nextWeight = blockWeight(block);
      if (page.length && weight + nextWeight > maxWeight) {
        flush();
        if (heading && block !== heading) {
          page.push(heading);
          weight = blockWeight(heading);
        }
      }
      page.push(block);
      weight += nextWeight;
    }
  }
  flush();
  return pages;
}

/**
 * Cada página usa columnas con la misma capacidad tipográfica que una página
 * de una columna. Así se reduce la cantidad de láminas sin encoger el texto ni
 * cortar la relación entre un subtítulo y su lista.
 */
export function paginateRichTextColumns(
  blocks: RichTextBlock[],
  columnCount = 3,
  maxColumnWeight = 16,
): RichTextBlock[][][] {
  const columns = paginateRichTextBlocks(blocks, maxColumnWeight);
  const pages: RichTextBlock[][][] = [];
  for (let index = 0; index < columns.length; index += columnCount) {
    pages.push(columns.slice(index, index + columnCount));
  }
  return pages;
}
