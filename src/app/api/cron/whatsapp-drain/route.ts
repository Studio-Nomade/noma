import { NextResponse } from "next/server";
import { gateCronRequest } from "@/lib/cron";
import { processPending } from "@/features/whatsapp/processor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const gate = gateCronRequest(request, "whatsapp-drain");
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const results = await processPending({ limit: 25, includeFailed: true });
  return NextResponse.json({
    ok: true,
    processed: results.length,
    done: results.filter((result) => result.status === "done").length,
    failed: results.filter((result) => result.status === "failed").length,
  });
}
