import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomFieldValues } from "@/features/asana/custom-fields";
import { aiFieldWishes } from "./asana-content";

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
