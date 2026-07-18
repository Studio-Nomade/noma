export type TimelineStage = {
  kind?: "stage";
  name: string;
  start: string;
  end: string;
};

export type TimelineMilestone = {
  kind: "milestone";
  date: string;
  description: string;
};

export type Stage = TimelineStage | TimelineMilestone;

export type GanttRow = {
  name: string;
  start: string;
  end: string;
  leftPct: number;
  widthPct: number;
};

export type GanttData = {
  rows: GanttRow[];
  monthLabels: { label: string; leftPct: number }[];
  milestones: { date: string; description: string; leftPct: number }[];
};

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** Calcula posiciones (%) de cada etapa y marcas de mes para la carta Gantt. */
export function computeGantt(
  stages: Stage[] | null | undefined,
): GanttData | null {
  const valid = (stages ?? []).filter(
    (item): item is TimelineStage =>
      item.kind !== "milestone" && Boolean(item.name && item.start && item.end),
  );
  if (valid.length === 0) return null;

  const starts = valid.map((s) => +new Date(s.start));
  const ends = valid.map((s) => +new Date(s.end));
  const min = Math.min(...starts);
  const max = Math.max(...ends);
  const span = Math.max(1, max - min);

  const rows: GanttRow[] = valid.map((s) => {
    const a = +new Date(s.start);
    const b = +new Date(s.end);
    return {
      name: s.name,
      start: s.start,
      end: s.end,
      leftPct: ((a - min) / span) * 100,
      widthPct: Math.max(3, ((b - a) / span) * 100),
    };
  });

  // marcas de inicio de mes dentro del rango
  const monthLabels: { label: string; leftPct: number }[] = [];
  const d = new Date(min);
  d.setDate(1);
  while (+d <= max) {
    const left = ((+d - min) / span) * 100;
    if (left >= 0 && left <= 100) {
      monthLabels.push({ label: MONTHS[d.getMonth()], leftPct: left });
    }
    d.setMonth(d.getMonth() + 1);
  }

  const milestones = (stages ?? [])
    .filter(
      (item): item is TimelineMilestone =>
        item.kind === "milestone" && Boolean(item.date && item.description),
    )
    .map((item) => ({
      date: item.date,
      description: item.description,
      leftPct: Math.max(
        0,
        Math.min(100, ((+new Date(item.date) - min) / span) * 100),
      ),
    }));

  return { rows, monthLabels, milestones };
}
