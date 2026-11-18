import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
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

export { resultSchema, type ArchitectResult } from "./result-schema";
import { roadmapSchema, type ArchitectResult } from "./result-schema";

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
    sin_encontrar: [] as string[],
    // Solicitudes a reflejar en Asana (tarea nueva o cambio de etapa).
    asanaItemIds: [] as string[],
  };

  await db.transaction(async (tx) => {
    // Roadmaps: crea o actualiza por código (el principal y los adicionales).
    async function registerRoadmap(r: z.infer<typeof roadmapSchema>) {
      const code = normalizeRoadmapCode(r.codigo);
      await tx
        .insert(devRoadmaps)
        .values({
          programId,
          code,
          title: r.titulo ?? code,
          month: r.mes ?? today.slice(0, 7),
          status: r.estado ?? "pendiente",
          kind: r.tipo ?? (code.startsWith("NDes") ? "modulo" : "mejora"),
        })
        .onConflictDoUpdate({
          target: [devRoadmaps.programId, devRoadmaps.code],
          set: {
            ...(r.titulo ? { title: r.titulo } : {}),
            ...(r.estado ? { status: r.estado } : {}),
            ...(r.tipo ? { kind: r.tipo } : {}),
            ...(r.mes ? { month: r.mes } : {}),
            updatedAt: new Date(),
          },
        });

      // Si el arquitecto usó un código sin reservarlo antes, el contador del
      // programa avanza igual, para que el siguiente no salga repetido.
      const n = Number(code.replace(/^(R|NDes-)/, ""));
      if (/^(R|NDes-)\d+$/.test(code) && Number.isFinite(n) && n > 0) {
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
      return code;
    }
    if (result.roadmap) summary.roadmap = await registerRoadmap(result.roadmap);
    for (const r of result.roadmaps) await registerRoadmap(r);

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
        // Dentro del paquete, por código; sin paquete, la más reciente del
        // programa con ese código (los códigos se repiten entre reuniones).
        const [target] = await tx
          .select({ id: devBacklog.id })
          .from(devBacklog)
          .where(
            itemIds
              ? and(inArray(devBacklog.id, itemIds), eq(devBacklog.code, s.id))
              : and(
                  eq(devBacklog.programId, programId),
                  eq(devBacklog.code, s.id),
                  inArray(devBacklog.status, [
                    "aprobada",
                    "en_asana",
                    "verificada",
                  ]),
                ),
          )
          .orderBy(desc(devBacklog.createdAt))
          .limit(1);
        if (!target) {
          summary.sin_encontrar.push(s.id);
          continue;
        }
        let roadmapCode: unknown = undefined;
        if (s.roadmap !== undefined) {
          roadmapCode = s.roadmap ? normalizeRoadmapCode(s.roadmap) : null;
          if (s.roadmap) {
            await tx
              .insert(devRoadmaps)
              .values({
                programId,
                code: roadmapCode as string,
                title: roadmapCode as string,
                month: today.slice(0, 7),
                kind: (roadmapCode as string).startsWith("NDes")
                  ? "modulo"
                  : "mejora",
              })
              .onConflictDoNothing();
          }
        } else if (
          summary.roadmap &&
          s.veredicto &&
          s.veredicto !== "ya_existe"
        ) {
          roadmapCode = sql`coalesce(${devBacklog.roadmapCode}, ${summary.roadmap})`;
        }
        await tx
          .update(devBacklog)
          .set({
            ...(s.veredicto
              ? { verdict: s.veredicto, status: "verificada" }
              : {}),
            ...(s.nota !== undefined ? { verdictNote: s.nota } : {}),
            ...(s.asana_gid ? { asanaTaskGid: s.asana_gid } : {}),
            ...(s.hito ? { milestone: s.hito } : {}),
            ...(s.estado ? { stage: s.estado } : {}),
            ...(roadmapCode !== undefined
              ? { roadmapCode: roadmapCode as string | null }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(devBacklog.id, target.id));
        summary.solicitudes++;
        if (s.veredicto || s.estado) summary.asanaItemIds.push(target.id);
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
