import { NextResponse } from "next/server";
import { gateCronRequest } from "@/lib/cron";
import { runMeetingsDigest } from "@/features/dev-tracking/minutes";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Una vez al día hábil (19:45 Santiago; Vercel Hobby no admite crons más
 * frecuentes que diarios): reuniones del seguimiento de desarrollo
 * que terminaron → transcripción de Gemini (Drive de la casilla de
 * operaciones) → minuta con Claude → solicitudes propuestas, borrador del
 * correo en la casilla y aviso en Slack. Manual: `?meeting=<id>` para una
 * reunión puntual y `?dry=1` para solo detectar sin resumir.
 */
export async function GET(request: Request) {
  const gate = gateCronRequest(request, "meetings-digest");
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const url = new URL(request.url);
  const results = await runMeetingsDigest({
    deadline: Date.now() + 270_000,
    dryRun: url.searchParams.get("dry") === "1",
    meetingId: url.searchParams.get("meeting"),
  });
  return NextResponse.json({ ok: true, results });
}
