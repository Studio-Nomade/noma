import { NextResponse } from "next/server";
import { gateCronRequest } from "@/lib/cron";
import { runStudioMeetingsCycle } from "@/features/meetings/flow";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cada 15 min en horario hábil: reuniones pedidas en #noma-reuniones que
 * terminaron → notas de Gemini a su carpeta en la unidad Operations, minuta
 * en un Google Doc y aviso en el hilo. Nada sale al cliente.
 */
export async function GET(request: Request) {
  const gate = gateCronRequest(request, "studio-meetings");
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const results = await runStudioMeetingsCycle({
    deadline: Date.now() + 270_000,
  });
  return NextResponse.json({ ok: true, results });
}
