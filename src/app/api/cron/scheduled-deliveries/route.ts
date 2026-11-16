import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { flushScheduledDeliveries } from "@/features/email/deliveries";
import { gateCronRequest } from "@/lib/cron";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Secreto de pg_cron: `NOMA_SCHEDULER_SECRET` o, si no está, el que Supabase
 * guarda en Vault (`noma_scheduler_secret`). Así el secreto se genera dentro
 * de la base y nadie tiene que copiarlo.
 */
async function schedulerSecret(): Promise<string | undefined> {
  const fromEnv = process.env.NOMA_SCHEDULER_SECRET?.trim();
  if (fromEnv) return fromEnv;
  try {
    const result = await db.execute<{ secret: string | null }>(
      sql`select decrypted_secret as secret from vault.decrypted_secrets where name = 'noma_scheduler_secret' limit 1`,
    );
    const rows = Array.isArray(result)
      ? result
      : ((result as { rows?: { secret: string | null }[] }).rows ?? []);
    return rows[0]?.secret?.trim() || undefined;
  } catch (error) {
    console.error("[cron:scheduled-deliveries:vault]", error);
    return undefined;
  }
}

/**
 * Envía las entregas y consultas que quedaron programadas fuera del horario
 * hábil (lun–vie 9:00–18:00, Santiago) y cuyo envío (08:55) ya llegó.
 *
 * Vercel Hobby no garantiza la hora exacta de sus crons, así que este endpoint
 * lo llama `pg_cron` de Supabase a las 08:55 (ver docs/technical/email-intake.md).
 * Usa la misma bandera que el mantenimiento del canal correo.
 */
export async function GET(request: Request) {
  const gate = gateCronRequest(request, "scheduled-deliveries", {
    ...process.env,
    NOMA_SCHEDULER_SECRET: await schedulerSecret(),
  });
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const result = await flushScheduledDeliveries({
    deadline: Date.now() + 50_000,
  });
  return NextResponse.json({ ok: true, ...result });
}

export const POST = GET;
