import { NextResponse } from "next/server";
import { gateCronRequest } from "@/lib/cron";
import { runDailyBriefings } from "@/features/assistant/briefing";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Resumen diario del asistente (lunes a viernes, 8:30 en Chile). Solo lectura:
 * lee las cuentas de cada persona del piloto y deja su resumen listo en el
 * inicio. Corre solo con CRON_ASSISTANT_BRIEFING_ENABLED=true.
 */
export async function GET(request: Request) {
  const gate = gateCronRequest(request, "assistant-briefing");
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const result = await runDailyBriefings();
  return NextResponse.json({ ok: true, ...result });
}
