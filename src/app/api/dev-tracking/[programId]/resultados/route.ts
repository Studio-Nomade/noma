import { ZodError } from "zod";
import {
  checkDevTrackingToken,
  loadProgram,
  notFound,
  unauthorized,
} from "@/features/dev-tracking/api-auth";
import {
  applyArchitectResult,
  resultSchema,
} from "@/features/dev-tracking/architect-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * El arquitecto publica el resultado de una sesión: veredictos por solicitud,
 * roadmap, módulos e hitos, bitácora y despliegues manuales. Ver el formato en
 * `features/dev-tracking/architect-sync.ts` (`resultSchema`).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ programId: string }> },
) {
  if (!checkDevTrackingToken(request)) return unauthorized();
  const { programId } = await params;
  const program = await loadProgram(programId);
  if (!program) return notFound();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "JSON inválido." },
      { status: 400 },
    );
  }
  try {
    const result = resultSchema.parse(body);
    const summary = await applyArchitectResult(program.id, result);
    return Response.json({ ok: true, resumen: summary });
  } catch (err) {
    if (err instanceof ZodError) {
      return Response.json(
        {
          ok: false,
          error: "Formato inválido.",
          issues: err.issues.slice(0, 10),
        },
        { status: 400 },
      );
    }
    console.error("[dev-tracking:resultados]", err);
    return Response.json(
      { ok: false, error: "No se pudo aplicar." },
      { status: 500 },
    );
  }
}
