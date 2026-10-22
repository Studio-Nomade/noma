import { NextResponse } from "next/server";
import { runCobranzaFollowup } from "@/features/finance/cobranza/followup-run";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Seguimiento de cobranza a 7 días (P3). Lo llama el cron de Vercel en días
 * hábiles. Por defecto solo deja borradores: el envío real exige
 * NOMA_COBRANZA_AUTOSEND=true.
 */
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
  const result = await runCobranzaFollowup();
  return NextResponse.json({ ok: true, ...result });
}
