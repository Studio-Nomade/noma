import {
  checkDevTrackingToken,
  loadProgram,
  notFound,
  unauthorized,
} from "@/features/dev-tracking/api-auth";
import {
  peekRoadmapCode,
  reserveRoadmapCode,
} from "@/features/dev-tracking/roadmap-numbering";

export const runtime = "nodejs";

/** GET: muestra el siguiente código sin reservarlo. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ programId: string }> },
) {
  if (!checkDevTrackingToken(request)) return unauthorized();
  const { programId } = await params;
  const program = await loadProgram(programId);
  if (!program) return notFound();
  return Response.json({
    ok: true,
    siguiente: await peekRoadmapCode(program.id),
  });
}

/** POST {tipo: "mejora" | "correccion" | "modulo"}: reserva y devuelve el código. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ programId: string }> },
) {
  if (!checkDevTrackingToken(request)) return unauthorized();
  const { programId } = await params;
  const program = await loadProgram(programId);
  if (!program) return notFound();
  const body = (await request.json().catch(() => ({}))) as { tipo?: string };
  const tipo =
    body.tipo === "modulo" || body.tipo === "correccion" ? body.tipo : "mejora";
  const code = await reserveRoadmapCode(program.id, tipo);
  return Response.json({ ok: true, codigo: code, tipo });
}
