import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildPackageYaml, toYaml } from "./package-yaml";

test("toYaml serializa objetos, listas y bloques", () => {
  const y = toYaml({
    a: "hola mundo",
    b: 3,
    c: true,
    d: null,
    e: [],
    f: ["x", { g: "y: z", h: "línea 1\nlínea 2" }],
    i: "2026-11-18",
  });
  assert.equal(
    y,
    [
      "a: hola mundo",
      "b: 3",
      "c: true",
      "d: null",
      "e: []",
      "f:",
      "  - x",
      '  - g: "y: z"',
      "    h: |",
      "      línea 1",
      "      línea 2",
      'i: "2026-11-18"',
      "",
    ].join("\n"),
  );
});

test("el paquete lleva id, solicitudes y el endpoint de resultado", () => {
  const y = buildPackageYaml({
    code: "PKG-2026-11-18-01",
    origen: "reunion",
    titulo: "Revisión Comercial",
    fecha: "2026-11-18",
    programa: "P",
    cliente: "C",
    participantes: [{ nombre: "Eduardo", area: "Comercial" }],
    transcripcion: "https://docs.google.com/document/d/abc",
    resumen: "Resumen.",
    confirmado_sin_desarrollo: ["Ya existe."],
    solicitudes: [
      {
        id: "CO-01",
        titulo: "Emergencia en curso",
        detalle: "…",
        planteada_por: "Mariela",
        area: "Comerciales",
        tipo: "Nuevo desarrollo",
        entorno: "Web",
        prioridad: "Alta",
        evidencia: "min 00:42",
        destino_sugerido: "roadmap_en_curso",
        roadmap: "R74",
        dependencias: [],
        asana_gid: null,
      },
    ],
    preguntas_abiertas: [
      { pregunta: "¿Quién marca?", para: "Comercial", desde: "2026-11-17" },
    ],
    prioridad_confirmada_por_sebastian: true,
    resultado_endpoint: "https://noma/api/dev-tracking/x/resultados",
  });
  assert.ok(y.startsWith("paquete:\n  id: PKG-2026-11-18-01\n"));
  assert.ok(y.includes("    - id: CO-01\n      titulo: Emergencia en curso"));
  assert.ok(y.includes("prioridad_confirmada_por_sebastian: true"));
  assert.ok(y.includes("roadmap: R74"));
});
