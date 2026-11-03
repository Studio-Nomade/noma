import { NextResponse } from "next/server";
import { syncRates } from "@/lib/currency/rates";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Sincroniza UF y USD del día desde la fuente configurada (mindicador)
 * y las guarda en `exchange_rates`. Lo dispara el cron diario de Vercel;
 * equivale a `npm run rates:sync` en local.
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
  try {
    const rates = await syncRates();
    return NextResponse.json({ ok: true, rates });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error sincronizando tasas.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
