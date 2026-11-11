import assert from "node:assert/strict";
import test from "node:test";
import { canvaIdFromUrl, extractCanvaDesignIds } from "./design-link-parse";

test("extrae ids de Canva y links cortos sin duplicar", () => {
  const result = extractCanvaDesignIds([
    "Link canva: https://www.canva.com/design/DAHaDgDWGmM/r_YP5sHkwB15r1kMrUmPiQ/edit",
    '<a href="https://www.canva.com/design/DAHaDgDWGmM/view">ver</a> y https://canva.link/brqunuw7048ywwz',
    null,
  ]);
  assert.deepEqual(result.ids, ["DAHaDgDWGmM"]);
  assert.deepEqual(result.shortLinks, ["https://canva.link/brqunuw7048ywwz"]);
});

test("id desde la URL a la que redirige un link corto", () => {
  assert.equal(
    canvaIdFromUrl(
      "https://www.canva.com/design/DAHakjc0Z7c/abc/view?utm_content=x",
    ),
    "DAHakjc0Z7c",
  );
  assert.equal(canvaIdFromUrl("https://www.canva.com/login"), null);
});
