import { NextResponse } from "next/server";
import { processNewProjects } from "@/features/project-setup/process";
import { gateCronRequest } from "@/lib/cron";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Proyectos nuevos de Asana → carpeta del cliente y del proyecto en la unidad
 * del área + canal de Slack vinculado a los avisos (reemplaza el Zap «Crear
 * Canal y Carpeta en Drive»). Cron de Vercel cada 10 minutos en horario hábil
 * (vercel.json; ver docs/technical/project-setup.md).
 */
export async function GET(request: Request) {
  const gate = gateCronRequest(request, "project-setup");
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const results = await processNewProjects({ deadline: Date.now() + 45_000 });
  return NextResponse.json({ ok: true, results });
}
