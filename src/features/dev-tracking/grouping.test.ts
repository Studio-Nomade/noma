import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  fallbackGrouping,
  normalizeGrouping,
  type GroupingItem,
  type OpenTarget,
} from "./grouping";

function item(id: string, extra: Partial<GroupingItem> = {}): GroupingItem {
  return {
    id,
    code: id.toUpperCase(),
    title: `Solicitud ${id}`,
    detail: null,
    area: "Técnicos",
    type: "Mejora funcional",
    environment: "Web",
    priority: "Normal",
    destination: null,
    roadmapCode: null,
    ...extra,
  };
}

const open: OpenTarget[] = [
  { code: "NDes-006", title: "Banco de Ensayo de Bombas", kind: "modulo" },
];

test("el respaldo separa roadmap abierto, soporte, módulo nuevo y mejoras por área", () => {
  const groups = fallbackGrouping(
    [
      item("op-01", { roadmapCode: "ndes-006" }),
      item("op-02", { type: "Soporte operativo" }),
      item("co-01", { type: "Nuevo desarrollo", area: "Comerciales" }),
      item("te-01"),
      item("te-02"),
    ],
    open,
  );
  const byKind = Object.fromEntries(groups.map((g) => [g.key, g.itemIds]));
  assert.deepEqual(byKind["existente:NDes-006"], ["op-01"]);
  assert.deepEqual(byKind["sin_roadmap"], ["op-02"]);
  assert.deepEqual(byKind["modulo:Comerciales"], ["co-01"]);
  assert.deepEqual(byKind["mejora:Técnicos"], ["te-01", "te-02"]);
});

test("normalizar descarta códigos inventados, repetidos y roadmaps cerrados", () => {
  const items = [item("op-01"), item("op-02"), item("op-03")];
  const groups = normalizeGrouping(
    {
      grupos: [
        {
          tipo: "existente",
          codigo_existente: "R50",
          titulo: "Ajustes al flujo",
          solicitudes: ["OP-01", "OP-01", "XX-99"],
        },
        { tipo: "mejora", titulo: "Mejoras", solicitudes: ["OP-02"] },
      ],
    },
    items,
    open,
  );
  assert.equal(groups.length, 3);
  assert.equal(groups[0].kind, "mejora");
  assert.equal(groups[0].code, null);
  assert.deepEqual(groups[0].itemIds, ["op-01"]);
  assert.deepEqual(groups[1].itemIds, ["op-02"]);
  // OP-03 quedó fuera de la IA y entra por el respaldo.
  assert.deepEqual(groups[2].itemIds, ["op-03"]);
});

test("normalizar respeta un roadmap abierto existente", () => {
  const groups = normalizeGrouping(
    {
      grupos: [
        {
          tipo: "existente",
          codigo_existente: "ndes-006",
          titulo: "Banco de ensayo",
          solicitudes: ["op-01"],
        },
      ],
    },
    [item("op-01")],
    open,
  );
  assert.equal(groups[0].kind, "existente");
  assert.equal(groups[0].code, "NDes-006");
});
