/**
 * Métricas del informe mensual de solicitudes, con los mismos criterios que
 * el panel de Asana: solo tareas de primer nivel (los duplicados de Zapier
 * viven como subtareas), «del mes» = creadas en el mes (hora de Chile) y
 * «finalizadas en la sección» = sección «<Mes> | <AAAA>» completas.
 *
 * Retrabajo: cuántas rondas de entrega necesitó cada solicitud
 * (ENTREGA 01, 02, …). Una pieza aprobada en la primera entrega tiene 1
 * ronda; cada ronda extra es un ciclo de cambios. Módulo puro.
 */

import { localDateParts, normalizeSectionName } from "@/features/email/dates";

/** Campo numérico de Asana con las rondas de entrega (panel Métricas). */
export const ROUNDS_FIELD = "Rondas de entrega";

export type ReportTask = {
  gid: string;
  name: string;
  createdAt: Date;
  completed: boolean;
  dueOn: string | null;
  sectionNames: string[];
  priority: string | null;
  /** Valores del campo de distribución (Área, Cliente…). */
  breakdown: string[];
  /** Rondas de entrega registradas (null: sin entregas registradas). */
  rounds: number | null;
};

export type ReportMonth = { year: number; month: number };

export type ReworkMetrics = {
  /** Solicitudes del mes con al menos una entrega registrada. */
  measured: number;
  /** Aprobadas en la primera entrega (1 ronda). */
  firstRound: number;
  firstRoundPct: number | null;
  /** Promedio de rondas por solicitud medida. */
  averageRounds: number | null;
  /** Rondas adicionales (suma de rondas − 1). */
  extraRounds: number;
  /** Solicitudes con 3 o más rondas. */
  threePlus: number;
  /** Tickets nuevos que piden cambios sobre piezas ya entregadas. */
  adjustmentTickets: number;
};

export type MonthlyMetrics = {
  month: string;
  created: number;
  finished: number;
  finishedPct: number | null;
  active: number;
  late: number;
  sectionFinished: number;
  highOrUrgent: number;
  highOrUrgentPct: number | null;
  priority: [string, number][];
  breakdown: [string, number][];
  rework: ReworkMetrics;
};

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function monthKey(month: ReportMonth) {
  return `${month.year}-${String(month.month).padStart(2, "0")}`;
}

export function parseMonthKey(value: string): ReportMonth | null {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(match[1]), month };
}

export function previousMonth(month: ReportMonth): ReportMonth {
  return month.month === 1
    ? { year: month.year - 1, month: 12 }
    : { year: month.year, month: month.month - 1 };
}

/** Mes anterior a la fecha dada (hora de Chile): lo que se informa el día 1. */
export function reportMonthFor(now: Date): ReportMonth {
  const local = localDateParts(now);
  return previousMonth({ year: local.year, month: local.month });
}

/** Sección mensual del tablero: «Noviembre | 2026». */
export function monthSectionLabel(month: ReportMonth) {
  return `${MONTHS[month.month - 1]} | ${month.year}`;
}

/** Un día cualquiera del mes (mediodía UTC del 15), para las plantillas. */
export function monthDate(month: ReportMonth) {
  return new Date(Date.UTC(month.year, month.month - 1, 15, 12));
}

export function isInMonth(date: Date, month: ReportMonth) {
  const local = localDateParts(date);
  return local.year === month.year && local.month === month.month;
}

/** «AJUSTES: …», «Correcciones …», «Últimos cambios …», «Cambios en …». */
const ADJUSTMENT_TICKET_RE =
  /^\s*(?:\[[^\]]*\]\s*)?(?:ajustes?|correcci(?:o|ó)n(?:es)?|cambios?|(?:últimos|ultimos)\s+cambios)\b/i;

export function isAdjustmentTicket(name: string) {
  return ADJUSTMENT_TICKET_RE.test(name);
}

/** Mayor número de ronda citado en comentarios («ENTREGA 02», «Entrega 3:»). */
export function roundsFromComments(texts: (string | null | undefined)[]) {
  let max = 0;
  for (const text of texts) {
    if (!text) continue;
    const match = text.match(/^\s*entrega\s*0*(\d{1,3})(?=$|[\s:·\-–—.,;])/i);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max || null;
}

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : null;
}

function counts(values: string[]): [string, number][] {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

const HIGH_PRIORITIES = new Set(["alta", "urgente"]);

export function computeMonthlyMetrics(
  tasks: ReportTask[],
  month: ReportMonth,
  today: string,
): MonthlyMetrics {
  const ofMonth = tasks.filter((task) => isInMonth(task.createdAt, month));
  const finished = ofMonth.filter((task) => task.completed).length;
  const active = ofMonth.length - finished;
  const late = ofMonth.filter(
    (task) => !task.completed && task.dueOn && task.dueOn < today,
  ).length;
  const section = normalizeSectionName(monthSectionLabel(month));
  const sectionFinished = tasks.filter(
    (task) =>
      task.completed &&
      task.sectionNames.some((name) => normalizeSectionName(name) === section),
  ).length;
  const priorities = ofMonth
    .map((task) => task.priority?.trim())
    .filter((value): value is string => Boolean(value));
  const highOrUrgent = priorities.filter((value) =>
    HIGH_PRIORITIES.has(value.toLowerCase()),
  ).length;

  const measured = ofMonth.filter((task) => (task.rounds ?? 0) > 0);
  const rounds = measured.map((task) => task.rounds ?? 0);
  const firstRound = rounds.filter((value) => value === 1).length;
  const totalRounds = rounds.reduce((sum, value) => sum + value, 0);

  return {
    month: monthKey(month),
    created: ofMonth.length,
    finished,
    finishedPct: pct(finished, ofMonth.length),
    active,
    late,
    sectionFinished,
    highOrUrgent,
    highOrUrgentPct: pct(highOrUrgent, ofMonth.length),
    priority: counts(priorities),
    breakdown: counts(ofMonth.flatMap((task) => task.breakdown)),
    rework: {
      measured: measured.length,
      firstRound,
      firstRoundPct: pct(firstRound, measured.length),
      averageRounds: measured.length
        ? Math.round((totalRounds / measured.length) * 10) / 10
        : null,
      extraRounds: totalRounds - measured.length,
      threePlus: rounds.filter((value) => value >= 3).length,
      adjustmentTickets: ofMonth.filter((task) => isAdjustmentTicket(task.name))
        .length,
    },
  };
}

function decimal(value: number) {
  return value.toLocaleString("es-CL", { maximumFractionDigits: 1 });
}

/** Indicadores para la plantilla 08 (Resumen). */
export function metricsIndicators(metrics: MonthlyMetrics) {
  const rows: {
    label: string;
    value: string;
    detail?: string | null;
    highlight?: boolean;
  }[] = [
    {
      label: "Solicitudes del mes",
      value: String(metrics.created),
      highlight: true,
    },
    {
      label: "Finalizadas",
      value: String(metrics.finished),
      detail: metrics.finishedPct !== null ? `${metrics.finishedPct}%` : null,
      highlight: true,
    },
    { label: "Activas", value: String(metrics.active) },
    { label: "Atrasadas", value: String(metrics.late) },
  ];
  if (metrics.created) {
    rows.push({
      label: "Prioridad Alta o Urgente",
      value: `${metrics.highOrUrgent} de ${metrics.created}`,
      detail:
        metrics.highOrUrgentPct !== null ? `${metrics.highOrUrgentPct}%` : null,
    });
  }
  if (metrics.breakdown.length) {
    rows.push({
      label: "Distribución",
      value: metrics.breakdown
        .slice(0, 4)
        .map(([name, count]) => `${name} ${count}`)
        .join(" · "),
    });
  }
  const rework = metrics.rework;
  if (rework.measured) {
    rows.push({
      label: "Aprobadas en la primera entrega",
      value: `${rework.firstRound} de ${rework.measured}`,
      detail: rework.firstRoundPct !== null ? `${rework.firstRoundPct}%` : null,
      highlight: true,
    });
    rows.push({
      label: "Rondas promedio por solicitud",
      value: decimal(rework.averageRounds ?? 0),
      detail: rework.extraRounds
        ? `${rework.extraRounds} ronda${rework.extraRounds === 1 ? "" : "s"} de cambios`
        : null,
    });
  }
  if (rework.adjustmentTickets) {
    rows.push({
      label: "Solicitudes de ajuste",
      value: String(rework.adjustmentTickets),
      detail: "cambios sobre piezas ya entregadas",
    });
  }
  return rows;
}

function variation(current: number, previous: number) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Hallazgos redactados a partir de las cifras (la Dirección los ajusta). */
export function metricsHighlights(
  current: MonthlyMetrics,
  previous: MonthlyMetrics | null,
  previousLabel: string,
): string[] {
  const out: string[] = [];
  const change = previous ? variation(current.created, previous.created) : null;
  if (previous && change !== null) {
    out.push(
      change === 0
        ? `Ingresaron ${current.created} solicitudes, igual que en ${previousLabel}.`
        : `Ingresaron ${current.created} solicitudes, ${Math.abs(change)}% ${change > 0 ? "más" : "menos"} que en ${previousLabel} (${previous.created}).`,
    );
  }
  if (current.created && current.finishedPct !== null) {
    out.push(
      `Se finalizó el ${current.finishedPct}% de lo ingresado: ${current.active} ${current.active === 1 ? "sigue activa" : "siguen activas"} y ${current.late} ${current.late === 1 ? "quedó atrasada" : "quedaron atrasadas"}.`,
    );
  }
  const rework = current.rework;
  if (rework.measured && rework.firstRoundPct !== null) {
    out.push(
      `El ${rework.firstRoundPct}% de las piezas se aprobó en la primera entrega; en promedio, cada solicitud necesitó ${decimal(rework.averageRounds ?? 0)} rondas${rework.threePlus ? ` y ${rework.threePlus} pasaron por 3 o más` : ""}.`,
    );
  }
  if (current.highOrUrgentPct !== null && current.highOrUrgentPct >= 50) {
    out.push(
      `El ${current.highOrUrgentPct}% de las solicitudes llegó con prioridad Alta o Urgente.`,
    );
  }
  return out.slice(0, 4);
}
