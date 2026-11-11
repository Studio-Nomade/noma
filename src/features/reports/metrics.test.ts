import assert from "node:assert/strict";
import test from "node:test";
import {
  computeMonthlyMetrics,
  isAdjustmentTicket,
  metricsHighlights,
  metricsIndicators,
  monthSectionLabel,
  previousMonth,
  reportMonthFor,
  roundsFromComments,
  type ReportTask,
} from "./metrics";

const NOV = { year: 2026, month: 11 };

function task(over: Partial<ReportTask>): ReportTask {
  return {
    gid: Math.random().toString(36).slice(2),
    name: "Pieza",
    createdAt: new Date("2026-11-10T15:00:00Z"),
    completed: true,
    dueOn: "2026-11-12",
    sectionNames: ["Noviembre | 2026"],
    priority: "Media",
    breakdown: [],
    rounds: null,
    ...over,
  };
}

test("mes del informe y sección mensual", () => {
  // 1 de diciembre 08:20 en Chile → se informa noviembre.
  assert.deepEqual(reportMonthFor(new Date("2026-12-01T11:20:00Z")), NOV);
  assert.deepEqual(previousMonth({ year: 2027, month: 1 }), {
    year: 2026,
    month: 12,
  });
  assert.equal(monthSectionLabel(NOV), "Noviembre | 2026");
});

test("cifras del mes como el panel: creadas en el mes (hora de Chile) y sección", () => {
  const tasks = [
    task({ priority: "Alta", rounds: 1, breakdown: ["B2B"] }),
    task({ priority: "Urgente", rounds: 2, breakdown: ["B2B"] }),
    task({ priority: "Alta", rounds: 3, breakdown: ["D2C"] }),
    task({ completed: false, dueOn: "2026-11-20", priority: "Normal" }),
    task({ completed: false, dueOn: "2026-12-20" }),
    // 30-11 22:00 en Chile = 01-12 01:00 UTC: sigue siendo de noviembre.
    task({
      createdAt: new Date("2026-12-01T01:00:00Z"),
      name: "Ajustes: post",
    }),
    // Creada en octubre pero trabajada en la sección de noviembre.
    task({ createdAt: new Date("2026-10-30T15:00:00Z") }),
    // Creada en diciembre: no cuenta en noviembre.
    task({
      createdAt: new Date("2026-12-02T15:00:00Z"),
      sectionNames: ["Diciembre | 2026"],
    }),
  ];
  const metrics = computeMonthlyMetrics(tasks, NOV, "2026-12-01");
  assert.equal(metrics.created, 6);
  assert.equal(metrics.finished, 4);
  assert.equal(metrics.finishedPct, 67);
  assert.equal(metrics.active, 2);
  assert.equal(metrics.late, 1);
  assert.equal(metrics.sectionFinished, 5);
  assert.equal(metrics.highOrUrgent, 3);
  assert.deepEqual(metrics.breakdown, [
    ["B2B", 2],
    ["D2C", 1],
  ]);
  assert.deepEqual(metrics.rework, {
    measured: 3,
    firstRound: 1,
    firstRoundPct: 33,
    averageRounds: 2,
    extraRounds: 3,
    threePlus: 1,
    adjustmentTickets: 1,
  });
});

test("rondas desde comentarios del equipo (cualquier mayúscula)", () => {
  assert.equal(
    roundsFromComments([
      "Entrega 01:\nhttps://x",
      "ENTREGA 02 https://y",
      "Entrega 2 queda para mañana",
    ]),
    2,
  );
  assert.equal(
    roundsFromComments(["Revisar la entrega 03 mañana", null]),
    null,
  );
  assert.equal(isAdjustmentTicket("AJUSTES: Post para LinkedIn"), true);
  assert.equal(
    isAdjustmentTicket("[G360-NOV-0174] Últimos cambios video Humanitas"),
    true,
  );
  assert.equal(isAdjustmentTicket("Correcciones Humanitas"), true);
  assert.equal(isAdjustmentTicket("Solicitud de cambio de logo"), false);
});

test("indicadores y hallazgos incluyen el retrabajo solo si hay entregas medidas", () => {
  const withRework = computeMonthlyMetrics(
    [task({ rounds: 1 }), task({ rounds: 2 })],
    NOV,
    "2026-12-01",
  );
  const rows = metricsIndicators(withRework);
  assert.ok(
    rows.some(
      (row) =>
        row.label === "Aprobadas en la primera entrega" &&
        row.value === "1 de 2",
    ),
  );
  assert.ok(
    rows.some(
      (row) =>
        row.label === "Rondas promedio por solicitud" && row.value === "1,5",
    ),
  );

  const without = computeMonthlyMetrics([task({})], NOV, "2026-12-01");
  assert.ok(
    !metricsIndicators(without).some((row) =>
      row.label.startsWith("Aprobadas"),
    ),
  );

  const previous = computeMonthlyMetrics(
    [task({ createdAt: new Date("2026-10-10T15:00:00Z") })],
    { year: 2026, month: 10 },
    "2026-12-01",
  );
  const highlights = metricsHighlights(withRework, previous, "octubre");
  assert.match(highlights[0], /2 solicitudes, 100% más que en octubre \(1\)/);
  assert.ok(
    highlights.some((line) =>
      /50% de las piezas se aprobó en la primera entrega/.test(line),
    ),
  );
});
