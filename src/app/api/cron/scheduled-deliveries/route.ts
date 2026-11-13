import { NextResponse } from "next/server";
import { flushScheduledDeliveries } from "@/features/email/deliveries";
import { gateCronRequest } from "@/lib/cron";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Envía las entregas y consultas que quedaron programadas fuera del horario
 * hábil (lun–vie 9:00–18:00, Santiago) y cuyo envío (08:55) ya llegó.
 *
 * Vercel Hobby no garantiza la hora exacta de sus crons, así que este endpoint
 * lo llama `pg_cron` de Supabase a las 08:55 (ver docs/technical/email-intake.md).
 * Usa la misma bandera que el mantenimiento del canal correo.
 */
export async function GET(request: Request) {
  const gate = gateCronRequest(request, "scheduled-deliveries");
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const result = await flushScheduledDeliveries({
    deadline: Date.now() + 50_000,
  });
  return NextResponse.json({ ok: true, ...result });
}

export const POST = GET;
