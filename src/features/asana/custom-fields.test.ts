import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCustomFieldValues,
  type AsanaCustomFieldSetting,
} from "./custom-fields";

const SETTINGS: AsanaCustomFieldSetting[] = [
  {
    custom_field: {
      gid: "prio",
      name: "Prioridad",
      resource_subtype: "enum",
      enum_options: [
        { gid: "p-urg", name: "Urgente" },
        { gid: "p-norm", name: "Normal" },
      ],
    },
  },
  {
    custom_field: {
      gid: "canal",
      name: "Canal",
      resource_subtype: "multi_enum",
      enum_options: [
        { gid: "c-li", name: "LinkedIn" },
        { gid: "c-ig", name: "Instagram" },
        { gid: "c-old", name: "Web", enabled: false },
      ],
    },
  },
  {
    custom_field: {
      gid: "cli",
      name: "Cliente",
      resource_subtype: "enum",
      enum_options: [{ gid: "cli-itm", name: "MarcaB Group" }],
    },
  },
  {
    custom_field: {
      gid: "folio",
      name: "Folio NOMA",
      resource_subtype: "text",
    },
  },
];

test("traduce deseos por nombre a custom_fields de Asana", () => {
  assert.deepEqual(
    buildCustomFieldValues(SETTINGS, [
      { kind: "enum", fields: ["Prioridad"], options: ["Baja", "Normal"] },
      {
        kind: "multi_enum",
        fields: ["Formato / Canal", "Canal"],
        options: ["LinkedIn", "Web", "LinkedIn"],
      },
      {
        kind: "enum",
        fields: ["Cliente final", "Cliente"],
        options: ["Marca B Group"],
      },
      { kind: "text", fields: ["Folio NOMA"], value: "CA-NOV-0042" },
      { kind: "enum", fields: ["Ingreso Solicitud"], options: ["Correo"] },
    ]),
    {
      prio: "p-norm",
      canal: ["c-li"],
      cli: "cli-itm",
      folio: "CA-NOV-0042",
    },
  );
});

test("no escribe en campos de otro tipo ni opciones inexistentes", () => {
  assert.deepEqual(
    buildCustomFieldValues(SETTINGS, [
      { kind: "text", fields: ["Prioridad"], value: "x" },
      { kind: "enum", fields: ["Canal"], options: ["LinkedIn"] },
      { kind: "enum", fields: ["Cliente"], options: ["Otra marca"] },
      { kind: "multi_enum", fields: ["Canal"], options: ["Web"] },
    ]),
    {},
  );
});
