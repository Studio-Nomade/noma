import { z } from "zod";
import {
  checkDevTrackingToken,
  loadProgram,
  notFound,
  unauthorized,
} from "@/features/dev-tracking/api-auth";
import { applyArchitectResult } from "@/features/dev-tracking/architect-sync";

export const runtime = "nodejs";

const schema = z.object({
  modulo: z.string().max(40).optional(),
  texto: z.string().min(3).max(2000),
});

/** Atajo: una línea de bitácora. POST {modulo?, texto}. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ programId: string }> },
) {
  if (!checkDevTrackingToken(request)) return unauthorized();
  const { programId } = await params;
  const program = await loadProgram(programId);
  if (!program) return notFound();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Formato inválido." },
      { status: 400 },
    );
  }
  await applyArchitectResult(program.id, {
    roadmaps: [],
    solicitudes: [],
    preguntas_nuevas: [],
    modulos: [],
    bitacora: [parsed.data],
    desplegado: [],
  });
  return Response.json({ ok: true });
}
