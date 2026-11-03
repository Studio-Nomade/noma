import { NextResponse } from "next/server";
import { gateCronRequest } from "@/lib/cron";
import { openCurrentRetainerPeriods } from "@/features/retainers/periods";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const gate = gateCronRequest(request, "retainers-open");
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const opened = await openCurrentRetainerPeriods();
  return NextResponse.json({ ok: true, activePeriods: opened });
}
