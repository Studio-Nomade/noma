import { after } from "next/server";
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
import { syncItemsToAsana } from "@/features/dev-tracking/asana-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * El arquitecto publica el resultado de una sesión: veredictos por solicitud,
 * roadmap, módulos e hitos, bitácora y despliegues manuales. Ver el formato en
 * `features/dev-tracking/architect-sync.ts` (`resultSchema`).
 *
 * Después de responder, Noma refleja en Asana las solicitudes revisadas
 * (tarea nueva «R76 · título») y los cambios de etapa (Estado y sección).
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
    const { asanaItemIds, ...summary } = await applyArchitectResult(
      program.id,
      result,
    );
    const asana = program.asanaProjectGid && asanaItemIds.length > 0;
    if (asana) {
      after(async () => {
        try {
          await syncItemsToAsana(program.id, asanaItemIds, {
            source: result.paquete ?? "arquitecto",
          });
        } catch (err) {
          console.error("[dev-tracking:resultados:asana]", err);
        }
      });
    }
    return Response.json({
      ok: true,
      resumen: summary,
      asana: asana
        ? `${asanaItemIds.length} solicitud(es) se reflejan en Asana en ~30 s`
        : "sin cambios en Asana",
    });
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
