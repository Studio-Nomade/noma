import { NextResponse } from "next/server";
import { openCurrentRetainerPeriods } from "@/features/retainers/periods";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Cron no configurado." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const opened = await openCurrentRetainerPeriods();
  return NextResponse.json({ ok: true, activePeriods: opened });
}
