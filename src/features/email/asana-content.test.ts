import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomFieldValues } from "@/features/asana/custom-fields";
import { aiFieldWishes, buildAdjustmentsStoryHtml } from "./asana-content";

const SETTINGS = [
  {
    custom_field: {
      gid: "f1",
      name: "Formato",
      resource_subtype: "multi_enum",
      enum_options: [
        { gid: "o1", name: "Video" },
        { gid: "o2", name: "Presentación" },
      ],
    },
  },
  {
    custom_field: {
      gid: "f2",
      name: "Área Cliente",
      resource_subtype: "enum",
      enum_options: [{ gid: "o3", name: "B2B" }],
    },
  },
  {
    custom_field: {
      gid: "f3",
      name: "Estado",
      resource_subtype: "enum",
      enum_options: [{ gid: "o4", name: "Aprobado" }],
    },
  },
];

test("la IA solo completa campos permitidos y opciones existentes", () => {
  const wishes = aiFieldWishes(
    [
      { field: "Formato", options: ["Video", "Presentacion", "Logo"] },
      { field: "area cliente", options: ["B2B"] },
      { field: "Estado", options: ["Aprobado"] },
      { field: "Otro campo", options: ["X"] },
    ],
    ["Formato", "Área Cliente", "Estado"],
  );
  assert.deepEqual(buildCustomFieldValues(SETTINGS, wishes), {
    f1: ["o1", "o2"],
    f2: "o3",
  });
});

test("sin campos permitidos no hay deseos", () => {
  assert.deepEqual(
    aiFieldWishes([{ field: "Formato", options: ["Video"] }], []),
    [],
  );
});

test("comentario de ajustes: lista numerada, referencias y siguiente entrega", () => {
  const html = buildAdjustmentsStoryHtml({
    round: 1,
    adjustments: [
      { text: "Cambiar el color del botón", reference: "Lámina 2" },
      { text: "Subir el logo <grande>", reference: null },
    ],
    doubts: ["¿El botón va en azul o verde?"],
  });
  assert.match(
    html,
    /^<body><strong>Ajustes pedidos por el cliente a la Entrega 01<\/strong><ol>/,
  );
  assert.match(
    html,
    /<li><strong>Lámina 2:<\/strong> Cambiar el color del botón<\/li>/,
  );
  assert.match(html, /Subir el logo &lt;grande&gt;/);
  assert.match(html, /<strong>Por confirmar<\/strong><ul><li>/);
  assert.match(html, /«ENTREGA 02»/);
  assert.match(html, /<\/body>$/);
});
