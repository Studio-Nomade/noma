import { NextResponse } from "next/server";
import { gateCronRequest } from "@/lib/cron";
import { runCobranzaFollowup } from "@/features/finance/cobranza/followup-run";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Seguimiento de cobranza a 7 días (P3), en días hábiles. Corre solo con
 * CRON_COBRANZA_SEGUIMIENTO_ENABLED=true; aun así deja borradores salvo que
 * NOMA_COBRANZA_AUTOSEND=true.
 */
export async function GET(request: Request) {
  const gate = gateCronRequest(request, "cobranza-seguimiento");
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const result = await runCobranzaFollowup();
  return NextResponse.json({ ok: true, ...result });
}
