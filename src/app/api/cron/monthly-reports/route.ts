import { NextResponse } from "next/server";
import { gateCronRequest } from "@/lib/cron";
import { parseMonthKey, reportMonthFor } from "@/features/reports/metrics";
import { runMonthlyReports } from "@/features/reports/monthly";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Día 1 de cada mes: arma el informe del mes anterior de cada canal con
 * `monthly_report` activo (borrador en la casilla + tarea del responsable).
 * Manual: `?month=2026-11` (mes a informar), `?alias=equifax@…` y `?dry=1`
 * (solo calcula las cifras, sin borrador ni tarea).
 */
export async function GET(request: Request) {
  const gate = gateCronRequest(request, "monthly-reports");
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const url = new URL(request.url);
  const month =
    parseMonthKey(url.searchParams.get("month") ?? "") ??
    reportMonthFor(new Date());
  const results = await runMonthlyReports({
    month,
    alias: url.searchParams.get("alias"),
    dryRun: url.searchParams.get("dry") === "1",
    deadline: Date.now() + 280_000,
  });
  return NextResponse.json({ ok: true, results });
}
