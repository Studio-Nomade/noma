import type { PrMonthRow } from "./queries";

const SERIES_VARS = [
  "var(--status-blue)",
  "var(--status-violet)",
  "var(--status-emerald)",
  "var(--status-amber)",
  "var(--status-slate)",
];

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

export function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${y.slice(2)}`;
}

/**
 * Barras apiladas de PR integrados por mes y repo, sin librería (mismo
 * criterio que `features/finance/flujo-bars.tsx`).
 */
export function PrBars({
  data,
  repos,
}: {
  data: PrMonthRow[];
  repos: string[];
}) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Todavía no hay PR registrados para este programa.
      </p>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.total));
  const H = 140;
  return (
    <div>
      <div className="flex items-end gap-3 overflow-x-auto pb-2">
        {data.map((d) => (
          <div
            key={d.month}
            className="flex min-w-[52px] flex-1 flex-col items-center gap-1.5"
            title={`${monthLabel(d.month)} · ${d.total} PR · ${repos
              .map((r) => `${r} ${d.byRepo[r] ?? 0}`)
              .join(" · ")}`}
          >
            <span className="font-heading text-xs font-semibold">
              {d.total}
            </span>
            <div
              className="flex w-full flex-col-reverse overflow-hidden rounded-md"
              style={{ height: `${H}px` }}
            >
              <div className="flex flex-1 flex-col-reverse">
                {repos.map((r, i) => {
                  const h = Math.round(((d.byRepo[r] ?? 0) / max) * H);
                  if (!h) return null;
                  return (
                    <div
                      key={r}
                      className="w-full"
                      style={{
                        height: `${h}px`,
                        background: SERIES_VARS[i % SERIES_VARS.length],
                        opacity: 0.9,
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <span className="text-muted-foreground text-[11px]">
              {monthLabel(d.month)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {repos.map((r, i) => (
          <span
            key={r}
            className="text-muted-foreground inline-flex items-center gap-1.5 text-xs"
          >
            <span
              className="size-2 rounded-sm"
              style={{ background: SERIES_VARS[i % SERIES_VARS.length] }}
            />
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Anillo de avance (0–100) dibujado con conic-gradient. */
export function ProgressRing({
  value,
  size = 64,
}: {
  value: number;
  size?: number;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--status-emerald) ${v * 3.6}deg, var(--status-slate-bg) 0)`,
      }}
      aria-label={`${v} % de avance`}
    >
      <div
        className="bg-card grid place-items-center rounded-full"
        style={{ width: size - 12, height: size - 12 }}
      >
        <span className="font-heading text-sm font-semibold">{v}%</span>
      </div>
    </div>
  );
}
