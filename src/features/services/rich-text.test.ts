import assert from "node:assert/strict";
import test from "node:test";
import {
  paginateRichTextBlocks,
  normalizeRichTextStorage,
  parseRichTextDocument,
  richTextBlocks,
  serializeRichTextDocument,
} from "./rich-text";

test("convierte listas históricas en un documento enriquecido", () => {
  const blocks = richTextBlocks(
    'noma-list:v1:[{"title":"Planificación","description":"Reunión inicial"}]',
    "deliverables",
  );

  assert.deepEqual(
    blocks.map((block) => ({
      kind: block.kind,
      text: block.runs.map((run) => run.text).join(""),
    })),
    [
      { kind: "heading", text: "Planificación" },
      { kind: "paragraph", text: "Reunión inicial" },
    ],
  );
});

test("conserva títulos, negritas y listas permitidas", () => {
  const value = serializeRichTextDocument({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "Community Management" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Hasta 4 publicaciones",
                    marks: [{ type: "bold" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  const blocks = richTextBlocks(value, "deliverables");

  assert.equal(blocks[0]?.kind, "heading");
  assert.equal(blocks[1]?.kind, "bullet");
  assert.equal(blocks[1]?.runs[0]?.bold, true);
});

test("descarta nodos y marcas no autorizados", () => {
  const value = serializeRichTextDocument({
    type: "doc",
    content: [
      {
        type: "script",
        content: [{ type: "text", text: "alert(1)" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Contenido seguro",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
    ],
  });
  const document = parseRichTextDocument(value, "deliverables");
  const blocks = richTextBlocks(value, "deliverables");

  assert.equal(
    document.content?.some((node) => node.type === "script"),
    false,
  );
  assert.equal(blocks[0]?.runs[0]?.text, "Contenido seguro");
  assert.equal(blocks[0]?.runs[0]?.bold, false);
  assert.equal(normalizeRichTextStorage(value, "deliverables"), value);
});

test("pagina contenido extenso sin descartar bloques", () => {
  const blocks = Array.from({ length: 30 }, (_, index) => ({
    kind: "bullet" as const,
    runs: [{ text: `Entregable ${index + 1}`, bold: false }],
    level: 0,
  }));
  const pages = paginateRichTextBlocks(blocks, 5);

  assert.ok(pages.length > 1);
  assert.equal(pages.flat().length, blocks.length);
});

test("mantiene un subtítulo junto al contenido que le sigue", () => {
  const blocks = [
    {
      kind: "heading" as const,
      runs: [{ text: "Planificación", bold: true }],
      level: 3,
    },
    ...Array.from({ length: 5 }, (_, index) => ({
      kind: "bullet" as const,
      runs: [{ text: `Actividad ${index + 1}`, bold: false }],
      level: 0,
    })),
  ];
  const pages = paginateRichTextBlocks(blocks, 16);

  assert.equal(pages.length, 1);
  assert.equal(pages[0]?.[0]?.kind, "heading");
});
