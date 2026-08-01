import assert from "node:assert/strict";
import { auditCompiledEmail, compileEmailDocument } from "./compiler.server";
import { buildEmailDocument } from "./document-builder";
import { emailDocumentSchema } from "./document";
import { emailStudioGenerationPlanSchema } from "./generation-plan";

export async function runDocumentBuilderTests() {
  const project = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Correo de prueba",
    subject: "Hola {{nombre}}",
    previewText: "Contenido personalizado",
    emailWidth: 700,
    canvasColor: "#f4f4f1",
    bodyColor: "#ffffff",
    textColor: "#333333",
  };

  const imageAsset = {
    id: "22222222-2222-4222-8222-222222222222",
    label: "Cabecera",
    publicUrl: "https://assets.example.test/header.png",
    width: 1400,
  };

  const document = buildEmailDocument({
    project,
    assets: [imageAsset],
    elements: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        type: "image",
        assetId: imageAsset.id,
        label: "Cabecera",
        content: null,
        href: "https://example.test",
        alt: "Cabecera del correo",
        align: "center",
        fontSize: 16,
        color: "#333333",
        backgroundColor: "#111111",
        padding: "0px",
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        type: "text",
        assetId: null,
        label: "Saludo",
        content: "Hola {{nombre}}, escríbenos",
        href: "mailto:hola@example.test",
        alt: "",
        align: "left",
        fontSize: 18,
        color: "#333333",
        backgroundColor: "#111111",
        padding: "20px 32px",
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        type: "button",
        assetId: null,
        label: "CTA",
        content: "Ver campaña",
        href: "{{campana_url}}",
        alt: "",
        align: "center",
        fontSize: 16,
        color: "#ffffff",
        backgroundColor: "#111111",
        padding: "16px 32px",
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        type: "spacer",
        assetId: null,
        label: "Espacio",
        content: "32",
        href: null,
        alt: "",
        align: "center",
        fontSize: 16,
        color: "#333333",
        backgroundColor: "#111111",
        padding: "0px",
      },
    ],
    variables: [
      {
        key: "nombre",
        label: "Nombre",
        sample: "Andrea",
        required: true,
      },
      {
        key: "campana_url",
        label: "URL campaña",
        sample: "https://example.test/campana",
        required: true,
      },
    ],
  });

  const parsed = emailDocumentSchema.parse(document);
  assert.equal(parsed.assets.length, 1);
  assert.equal(parsed.sections[0]?.type, "card");
  assert.equal(parsed.sections[0]?.blocks.length, 4);

  const compiled = await compileEmailDocument(parsed, {
    assetBaseUrl: "https://noma.example.test",
  });
  assert.match(compiled.html, /https:\/\/assets\.example\.test\/header\.png/);
  assert.match(compiled.html, /mailto:hola@example\.test/);
  assert.match(compiled.html, /alt="Cabecera del correo"/);
  assert.match(compiled.html, /\{\{campana_url\}\}/);
  assert.match(compiled.mjml, /mj-wrapper padding="0px 0px 0px"/);
  assert.doesNotMatch(compiled.mjml, /mj-spacer height="54px"/);
  assert.doesNotMatch(compiled.mjml, /mj-button[^>]*width="100%"/);
  assert.equal(
    auditCompiledEmail(compiled).some((item) => item.level === "error"),
    false,
  );

  assert.throws(() =>
    buildEmailDocument({
      project,
      assets: [{ ...imageAsset, publicUrl: null }],
      elements: [
        {
          id: "77777777-7777-4777-8777-777777777777",
          type: "image",
          assetId: imageAsset.id,
          label: "Imagen inválida",
          content: null,
          href: null,
          alt: "Imagen",
          align: "center",
          fontSize: 16,
          color: "#333333",
          backgroundColor: "#111111",
          padding: "0px",
        },
      ],
      variables: [],
    }),
  );

  assert.equal(
    emailStudioGenerationPlanSchema.parse({
      subject: "Campaña",
      previewText: "Preview",
      variables: [],
      elements: [
        {
          type: "image",
          label: "Hero",
          assetId: imageAsset.id,
          content: null,
          href: "https://example.test",
          alt: "Hero",
          align: "center",
          fontSize: 16,
          color: "#333333",
          backgroundColor: "#111111",
          spacerHeight: null,
        },
      ],
    }).elements[0]?.assetId,
    imageAsset.id,
  );
}
