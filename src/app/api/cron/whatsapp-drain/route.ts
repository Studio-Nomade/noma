import { NextResponse } from "next/server";
import { processPending } from "@/features/whatsapp/processor";

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
  const results = await processPending({ limit: 25, includeFailed: true });
  return NextResponse.json({
    ok: true,
    processed: results.length,
    done: results.filter((result) => result.status === "done").length,
    failed: results.filter((result) => result.status === "failed").length,
  });
}
