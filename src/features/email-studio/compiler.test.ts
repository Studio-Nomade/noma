import assert from "node:assert/strict";
import { auditCompiledEmail, compileEmailDocument } from "./compiler.server";
import { emailDocumentSchema } from "./document";
import { emailStudioPrototype } from "./prototype-document";

export async function runCompilerTests() {
  const parsed = emailDocumentSchema.parse(emailStudioPrototype);
  assert.equal(parsed.version, "1.0");
  assert.equal(parsed.sections.length, 3);

  const compiled = await compileEmailDocument(parsed, {
    assetBaseUrl: "https://assets.example.test",
  });

  assert.match(compiled.html, /<!doctype html>/i);
  assert.match(
    compiled.html,
    /https:\/\/assets\.example\.test\/assets\/brand\/nomade-black\.png/,
  );
  assert.match(compiled.html, /\{\{nombre_apellido\}\}/);
  assert.match(compiled.html, /\{\{reporte_url\}\}/);
  assert.match(compiled.html, /href="\{\{linkedin_url\}\}"/);
  assert.doesNotMatch(compiled.html, /<script/i);
  assert.equal(compiled.warnings.at(-1)?.includes("HTTPS"), true);
  const audit = auditCompiledEmail(compiled);
  assert.equal(
    audit.find((item) => item.label === "Peso del HTML")?.level,
    "pass",
  );

  const escapedInput = structuredClone(emailStudioPrototype);
  escapedInput.assets = escapedInput.assets.map((asset) => ({
    ...asset,
    path: `https://assets.example.test/${asset.id}.png`,
  }));
  const escapedCard = escapedInput.sections.find(
    (section) => section.type === "card",
  );
  if (!escapedCard || escapedCard.type !== "card") {
    throw new Error("El fixture necesita una sección card.");
  }
  const escapedText = escapedCard.blocks.find((block) => block.type === "text");
  if (!escapedText || escapedText.type !== "text") {
    throw new Error("El fixture necesita un bloque de texto.");
  }
  escapedText.content =
    'Contenido <img src="http://insecure.example/pixel.gif" alt="">';
  const escaped = await compileEmailDocument(escapedInput, {
    assetBaseUrl: "https://noma.example.test",
  });
  assert.doesNotMatch(escaped.html, /<img src="http:\/\/insecure\.example/);
  assert.match(escaped.html, /&lt;img src=&quot;http:\/\/insecure\.example/);
  assert.equal(
    auditCompiledEmail(escaped).some((item) => item.level === "error"),
    false,
  );
  assert.equal(
    audit.find((item) => item.label === "Assets públicos")?.level,
    "error",
  );

  assert.throws(
    () =>
      emailDocumentSchema.parse({
        ...emailStudioPrototype,
        assets: emailStudioPrototype.assets.slice(1),
      }),
    /asset inexistente/,
  );
}
