import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { processNewProjects } from "@/features/project-setup/process";
import { gateCronRequest } from "@/lib/cron";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Mismo secreto de pg_cron que las entregas programadas (Vault). */
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
    console.error("[cron:project-setup:vault]", error);
    return undefined;
  }
}

/**
 * Proyectos nuevos de Asana → carpeta del cliente y del proyecto en la unidad
 * del área + canal de Slack (reemplaza el Zap «Crear Canal y Carpeta en
 * Drive»). Lo llama pg_cron cada 10 minutos (ver docs/technical/project-setup.md).
 */
export async function GET(request: Request) {
  const gate = gateCronRequest(request, "project-setup", {
    ...process.env,
    NOMA_SCHEDULER_SECRET: await schedulerSecret(),
  });
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const results = await processNewProjects({ deadline: Date.now() + 45_000 });
  return NextResponse.json({ ok: true, results });
}

export const POST = GET;
