import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { devMilestones, devModules, devQuestions } from "@/db/schema";
import {
  checkDevTrackingToken,
  loadProgram,
  notFound,
  unauthorized,
} from "@/features/dev-tracking/api-auth";

export const runtime = "nodejs";

/** Estado actual del programa para que el arquitecto parta con contexto. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ programId: string }> },
) {
  if (!checkDevTrackingToken(request)) return unauthorized();
  const { programId } = await params;
  const program = await loadProgram(programId);
  if (!program) return notFound();
  const modules = await db
    .select()
    .from(devModules)
    .where(
      and(
        eq(devModules.programId, program.id),
        sql`${devModules.archivedAt} is null`,
      ),
    )
    .orderBy(asc(devModules.sortOrder));
  const milestones = await db
    .select({
      moduleId: devMilestones.moduleId,
      nombre: devMilestones.name,
      estado: devMilestones.status,
      fecha: devMilestones.date,
      asana_gid: devMilestones.asanaTaskGid,
      prs: devMilestones.prNumbers,
    })
    .from(devMilestones)
    .innerJoin(devModules, eq(devModules.id, devMilestones.moduleId))
    .where(eq(devModules.programId, program.id))
    .orderBy(asc(devMilestones.sortOrder));
  const questions = await db
    .select({
      pregunta: devQuestions.question,
      para: devQuestions.forWhom,
      desde: devQuestions.since,
      bloquea: devQuestions.blocks,
    })
    .from(devQuestions)
    .where(
      and(
        eq(devQuestions.programId, program.id),
        eq(devQuestions.status, "abierta"),
      ),
    );
  return Response.json({
    ok: true,
    programa: {
      id: program.id,
      nombre: program.name,
      siguiente_roadmap: `R${program.nextRoadmapNumber}`,
      siguiente_modulo: `NDes-${String(program.nextModuleNumber).padStart(3, "0")}`,
    },
    modulos: modules.map((m) => ({
      codigo: m.code,
      nombre: m.name,
      objetivo: m.objective,
      inicio: m.startDate,
      entrega_objetivo: m.targetDate,
      avance: m.progress,
      criterio: m.criteria,
      pelota: { quien: m.ballOwner, que: m.ballWhat },
      proximo_seguimiento: m.nextFollowUp,
      en_produccion: m.inProduction,
      pendientes: m.pending,
      hitos: milestones
        .filter((h) => h.moduleId === m.id)
        .map((h) => ({
          nombre: h.nombre,
          estado: h.estado,
          fecha: h.fecha,
          asana_gid: h.asana_gid,
          prs: h.prs,
        })),
    })),
    preguntas_abiertas: questions,
  });
}
