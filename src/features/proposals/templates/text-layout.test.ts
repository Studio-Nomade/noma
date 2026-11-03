import assert from "node:assert/strict";
import test from "node:test";
import {
  paginateColumns,
  paginateTextBlocks,
  parseProposalText,
} from "./text-layout";

test("líneas numeradas con dos puntos se vuelven subtítulo + párrafo", () => {
  const blocks = parseProposalText(
    "01 · Producción audiovisual light: 5 cápsulas en una jornada.\n02 · Brochure editable: pieza en Canva.",
  );
  assert.deepEqual(
    blocks.map((block) => block.kind),
    ["heading", "paragraph", "heading", "paragraph"],
  );
  assert.equal(blocks[0].runs[0].text, "01 · Producción audiovisual light");
  assert.equal(blocks[1].runs[0].text, "5 cápsulas en una jornada.");
});

test("una frase larga con dos puntos queda como entrada en negrita", () => {
  const [block] = parseProposalText(
    "Humanizar la marca y ordenar su comunicación comercial: mostrar a las personas detrás del emprendimiento.",
  );
  assert.equal(block.kind, "paragraph");
  assert.equal(block.runs[0].bold, true);
  assert.match(block.runs[0].text, /comercial:$/);
});

test("enumeraciones con punto y coma se convierten en viñetas", () => {
  const blocks = parseProposalText(
    "Arriendo de estudio; actores o modelos; producción de alta complejidad; jornadas adicionales.",
  );
  assert.equal(blocks.length, 4);
  assert.ok(blocks.every((block) => block.kind === "bullet"));
  assert.equal(blocks[0].runs[0].text, "Arriendo de estudio");
  assert.equal(blocks[3].runs[0].text, "Jornadas adicionales");
});

test("un párrafo largo se reparte en párrafos de dos oraciones", () => {
  const text = Array.from(
    { length: 6 },
    (_, index) => `Oración número ${index + 1} con algo de contenido extra.`,
  ).join(" ");
  const blocks = parseProposalText(text, { emphasizeLead: false });
  assert.equal(blocks.length, 3);
  assert.ok(blocks.every((block) => block.kind === "paragraph"));
});

test("sin negritas ni subtítulos, la primera oración se destaca", () => {
  const [block] = parseProposalText(
    "BODEN es un emprendimiento. Hoy su comunicación está repartida.",
  );
  assert.equal(block.runs[0].bold, true);
  assert.equal(block.runs[0].text, "BODEN es un emprendimiento.");
});

test("la paginación mantiene cada subtítulo con su primer párrafo", () => {
  const blocks = parseProposalText(
    [
      "01 · Uno: " + "x".repeat(340),
      "02 · Dos: " + "y".repeat(340),
      "03 · Tres: " + "z".repeat(340),
    ].join("\n"),
  );
  const pages = paginateTextBlocks(blocks, 19, 64);
  assert.equal(pages.length, 2);
  assert.equal(pages[0][0].kind, "heading");
  assert.equal(pages[1][0].kind, "heading");
});

test("paginateColumns agrupa columnas por lámina", () => {
  const blocks = Array.from({ length: 12 }, (_, index) => ({
    kind: "bullet" as const,
    runs: [{ text: `Elemento ${index} `.repeat(6), bold: false }],
  }));
  const pages = paginateColumns(blocks, 3, 8, 50);
  assert.ok(pages.length >= 1);
  assert.ok(pages.every((page) => page.length <= 3));
  assert.equal(pages.flat(2).length, 12);
  assert.deepEqual(paginateColumns([], 3, 8, 50), []);
});
