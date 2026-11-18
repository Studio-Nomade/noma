import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  devBacklog,
  devPrograms,
  devLog,
  devMilestones,
  devModules,
  devPackages,
  devPrs,
  devQuestions,
  devRoadmaps,
} from "@/db/schema";
import { MILESTONE_STATUSES } from "./constants";
import { normalizeRoadmapCode } from "./roadmap-code";

/**
 * Lo que el arquitecto (Claude Code) le devuelve a Noma al cerrar una sesión.
 * Reemplaza la edición a mano de `datos.js`: veredictos por solicitud, estado
 * de módulos e hitos, pelota, bitácora y despliegues manuales (Lambda, APK).
 */

function todayLocal() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
  }).format(new Date());
}

const moduleSchema = z.object({
  codigo: z.string().min(2).max(40),
  nombre: z.string().min(2).max(200).optional(),
  objetivo: z.string().max(2000).optional(),
  inicio: z.string().date().optional(),
  entrega_objetivo: z.string().date().optional(),
  avance: z.number().int().min(0).max(100).optional(),
  criterio: z.string().max(1000).optional(),
  pelota: z
    .object({
      quien: z.string().max(200).optional(),
      que: z.string().max(2000).optional(),
    })
    .optional(),
  proximo_seguimiento: z.string().date().optional(),
  en_produccion: z.array(z.string().max(500)).optional(),
  pendientes: z.array(z.string().max(500)).optional(),
  hitos: z
    .array(
      z.object({
        nombre: z.string().min(1).max(200),
        estado: z.enum(MILESTONE_STATUSES),
        fecha: z.string().date().optional(),
        asana_gid: z.string().max(40).optional(),
        prs: z.array(z.string().max(60)).optional(),
      }),
    )
    .optional(),
});

export const resultSchema = z.object({
  paquete: z.string().max(40).optional(),
  roadmap: z
    .object({
      codigo: z.string().min(2).max(40),
      titulo: z.string().max(200).optional(),
      tipo: z.enum(["modulo", "mejora", "correccion"]).optional(),
      estado: z.enum(["en_prod", "parcial", "pendiente"]).optional(),
      mes: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .optional(),
    })
    .optional(),
  solicitudes: z
    .array(
      z.object({
        id: z.string().min(2).max(20), // CO-01
        veredicto: z.enum([
          "ya_existe",
          "bug",
          "requiere_desarrollo",
          "bloqueada",
        ]),
        hito: z.string().max(40).optional(),
        asana_gid: z.string().max(40).optional(),
        nota: z.string().max(2000).optional(),
      }),
    )
    .default([]),
  preguntas_nuevas: z
    .array(
      z.object({
        pregunta: z.string().min(3).max(1000),
        para: z.string().max(200).optional(),
        bloquea: z.string().max(100).optional(),
      }),
    )
    .default([]),
  modulos: z.array(moduleSchema).default([]),
  bitacora: z
    .array(
      z.object({
        modulo: z.string().max(40).optional(),
        texto: z.string().min(3).max(2000),
      }),
    )
    .default([]),
  desplegado: z
    .array(
      z.object({
        repo: z.string().min(2).max(80),
        numero: z.number().int().positive().optional(),
        titulo: z.string().max(300).optional(),
        fecha: z.string().date().optional(),
        roadmap: z.string().max(40).optional(),
      }),
    )
    .default([]),
});

export type ArchitectResult = z.infer<typeof resultSchema>;

export async function applyArchitectResult(
  programId: string,
  result: ArchitectResult,
) {
  const today = todayLocal();
  const summary = {
    solicitudes: 0,
    preguntas: 0,
    modulos: 0,
    hitos: 0,
    bitacora: 0,
    desplegado: 0,
    roadmap: null as string | null,
  };

  await db.transaction(async (tx) => {
    // Roadmap: crea o actualiza por código.
    if (result.roadmap) {
      const code = normalizeRoadmapCode(result.roadmap.codigo);
      await tx
        .insert(devRoadmaps)
        .values({
          programId,
          code,
          title: result.roadmap.titulo ?? code,
          month: result.roadmap.mes ?? today.slice(0, 7),
          status: result.roadmap.estado ?? "pendiente",
          kind:
            result.roadmap.tipo ??
            (code.startsWith("NDes") ? "modulo" : "mejora"),
        })
        .onConflictDoUpdate({
          target: [devRoadmaps.programId, devRoadmaps.code],
          set: {
            ...(result.roadmap.titulo ? { title: result.roadmap.titulo } : {}),
            ...(result.roadmap.estado ? { status: result.roadmap.estado } : {}),
            ...(result.roadmap.tipo ? { kind: result.roadmap.tipo } : {}),
            ...(result.roadmap.mes ? { month: result.roadmap.mes } : {}),
            updatedAt: new Date(),
          },
        });
      summary.roadmap = code;

      // Si el arquitecto usó un código sin reservarlo antes, el contador del
      // programa avanza igual, para que el siguiente no salga repetido.
      const n = Number(code.replace(/^(R|NDes-)/, ""));
      if (Number.isFinite(n) && n > 0) {
        await tx
          .update(devPrograms)
          .set(
            code.startsWith("NDes-")
              ? {
                  nextModuleNumber: sql`greatest(${devPrograms.nextModuleNumber}, ${n + 1})`,
                  updatedAt: new Date(),
                }
              : {
                  nextRoadmapNumber: sql`greatest(${devPrograms.nextRoadmapNumber}, ${n + 1})`,
                  updatedAt: new Date(),
                },
          )
          .where(eq(devPrograms.id, programId));
      }
    }

    // Veredictos por solicitud (código dentro del paquete / reunión).
    if (result.solicitudes.length) {
      let itemIds: string[] | null = null;
      if (result.paquete) {
        const [pkg] = await tx
          .select({ id: devPackages.id, itemIds: devPackages.itemIds })
          .from(devPackages)
          .where(
            and(
              eq(devPackages.programId, programId),
              eq(devPackages.code, result.paquete),
            ),
          )
          .limit(1);
        if (pkg) {
          itemIds = pkg.itemIds;
          await tx
            .update(devPackages)
            .set({
              status: "con_resultado",
              result: result as unknown as Record<string, unknown>,
              resultAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(devPackages.id, pkg.id));
        }
      }
      for (const s of result.solicitudes) {
        const where = itemIds
          ? and(inArray(devBacklog.id, itemIds), eq(devBacklog.code, s.id))
          : and(
              eq(devBacklog.programId, programId),
              eq(devBacklog.code, s.id),
              inArray(devBacklog.status, ["aprobada", "en_asana"]),
            );
        const rows = await tx
          .update(devBacklog)
          .set({
            verdict: s.veredicto,
            verdictNote: s.nota ?? null,
            ...(s.asana_gid ? { asanaTaskGid: s.asana_gid } : {}),
            ...(summary.roadmap && s.veredicto !== "ya_existe"
              ? { roadmapCode: summary.roadmap }
              : {}),
            status: "verificada",
            updatedAt: new Date(),
          })
          .where(where)
          .returning({ id: devBacklog.id });
        summary.solicitudes += rows.length;
      }
    }

    if (result.preguntas_nuevas.length) {
      await tx.insert(devQuestions).values(
        result.preguntas_nuevas.map((q) => ({
          programId,
          question: q.pregunta,
          forWhom: q.para ?? null,
          since: today,
          blocks: q.bloquea ?? null,
          status: "abierta",
          source: "claude_code",
        })),
      );
      summary.preguntas = result.preguntas_nuevas.length;
    }

    // Módulos e hitos (upsert por código / nombre).
    for (const m of result.modulos) {
      const [mod] = await tx
        .insert(devModules)
        .values({
          programId,
          code: m.codigo,
          name: m.nombre ?? m.codigo,
          objective: m.objetivo ?? null,
          startDate: m.inicio ?? null,
          targetDate: m.entrega_objetivo ?? null,
          progress: m.avance ?? 0,
          criteria: m.criterio ?? null,
          ballOwner: m.pelota?.quien ?? null,
          ballWhat: m.pelota?.que ?? null,
          nextFollowUp: m.proximo_seguimiento ?? null,
          inProduction: m.en_produccion ?? [],
          pending: m.pendientes ?? [],
        })
        .onConflictDoUpdate({
          target: [devModules.programId, devModules.code],
          set: {
            ...(m.nombre ? { name: m.nombre } : {}),
            ...(m.objetivo !== undefined ? { objective: m.objetivo } : {}),
            ...(m.inicio ? { startDate: m.inicio } : {}),
            ...(m.entrega_objetivo ? { targetDate: m.entrega_objetivo } : {}),
            ...(m.avance !== undefined ? { progress: m.avance } : {}),
            ...(m.criterio !== undefined ? { criteria: m.criterio } : {}),
            ...(m.pelota
              ? {
                  ballOwner: m.pelota.quien ?? null,
                  ballWhat: m.pelota.que ?? null,
                }
              : {}),
            ...(m.proximo_seguimiento
              ? { nextFollowUp: m.proximo_seguimiento }
              : {}),
            ...(m.en_produccion ? { inProduction: m.en_produccion } : {}),
            ...(m.pendientes ? { pending: m.pendientes } : {}),
            updatedAt: new Date(),
          },
        })
        .returning({ id: devModules.id });
      summary.modulos++;
      let order = 0;
      for (const h of m.hitos ?? []) {
        const [prev] = await tx
          .select({ status: devMilestones.status })
          .from(devMilestones)
          .where(
            and(
              eq(devMilestones.moduleId, mod.id),
              eq(devMilestones.name, h.nombre),
            ),
          )
          .limit(1);
        await tx
          .insert(devMilestones)
          .values({
            moduleId: mod.id,
            name: h.nombre,
            status: h.estado,
            date: h.fecha ?? (h.estado === "en_prod" ? today : null),
            asanaTaskGid: h.asana_gid ?? null,
            prNumbers: h.prs ?? [],
            sortOrder: order++,
          })
          .onConflictDoUpdate({
            target: [devMilestones.moduleId, devMilestones.name],
            set: {
              status: h.estado,
              ...(h.fecha
                ? { date: h.fecha }
                : h.estado === "en_prod"
                  ? { date: today }
                  : {}),
              ...(h.asana_gid ? { asanaTaskGid: h.asana_gid } : {}),
              ...(h.prs ? { prNumbers: h.prs } : {}),
              updatedAt: new Date(),
            },
          });
        summary.hitos++;
        if (prev && prev.status !== h.estado) {
          await tx
            .insert(devLog)
            .values({
              programId,
              date: today,
              moduleId: mod.id,
              moduleCode: m.codigo,
              text: `${h.nombre}: ${prev.status} → ${h.estado}`,
              source: "claude",
            })
            .onConflictDoNothing();
        }
      }
    }

    // Bitácora libre.
    if (result.bitacora.length) {
      const codes = [
        ...new Set(result.bitacora.map((b) => b.modulo).filter(Boolean)),
      ] as string[];
      const mods = codes.length
        ? await tx
            .select({ id: devModules.id, code: devModules.code })
            .from(devModules)
            .where(
              and(
                eq(devModules.programId, programId),
                inArray(devModules.code, codes),
              ),
            )
        : [];
      const idByCode = new Map(mods.map((m) => [m.code, m.id]));
      await tx
        .insert(devLog)
        .values(
          result.bitacora.map((b) => ({
            programId,
            date: today,
            moduleId: b.modulo ? (idByCode.get(b.modulo) ?? null) : null,
            moduleCode: b.modulo ?? null,
            text: b.texto,
            source: "claude",
          })),
        )
        .onConflictDoNothing();
      summary.bitacora = result.bitacora.length;
    }

    // Despliegues manuales (Lambda, APK): quedan como PR integrados si traen número.
    for (const d of result.desplegado) {
      if (d.numero) {
        await tx
          .insert(devPrs)
          .values({
            programId,
            repo: d.repo,
            number: d.numero,
            title: d.titulo ?? `${d.repo}#${d.numero}`,
            baseBranch: "main",
            month: (d.fecha ?? today).slice(0, 7),
            roadmapCode: d.roadmap ? normalizeRoadmapCode(d.roadmap) : null,
            isPromotion: false,
            source: "claude",
          })
          .onConflictDoNothing();
      }
      await tx
        .insert(devLog)
        .values({
          programId,
          date: d.fecha ?? today,
          text: `Desplegado ${d.repo}${d.numero ? `#${d.numero}` : ""}${d.titulo ? ` · ${d.titulo}` : ""}`,
          source: "claude",
        })
        .onConflictDoNothing();
      summary.desplegado++;
    }
  });

  await db
    .insert(devLog)
    .values({
      programId,
      date: today,
      text: `Sesión del arquitecto: ${summary.solicitudes} veredictos, ${summary.hitos} hitos, ${summary.bitacora} notas${summary.roadmap ? ` · ${summary.roadmap}` : ""}`,
      source: "claude",
    })
    .onConflictDoNothing();

  return summary;
}
