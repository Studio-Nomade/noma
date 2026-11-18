"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  devBacklog,
  devLog,
  devModules,
  devPrograms,
  devRoadmaps,
} from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { callClaudeStructured, claudeConfigured } from "@/lib/ai/claude";
import { requireUser } from "@/lib/auth";
import {
  GROUP_KINDS,
  GROUPING_SYSTEM_PROMPT,
  fallbackGrouping,
  groupingOutputSchema,
  groupingUserPrompt,
  normalizeGrouping,
  type GroupingItem,
  type GroupingOutput,
  type OpenTarget,
  type ProposedGroup,
} from "./grouping";
import { reserveRoadmapCode } from "./roadmap-numbering";

function todayLocal() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
  }).format(new Date());
}

async function programRow(programId: string) {
  const [p] = await db
    .select({
      id: devPrograms.id,
      name: devPrograms.name,
      projectId: devPrograms.projectId,
    })
    .from(devPrograms)
    .where(eq(devPrograms.id, programId))
    .limit(1);
  return p ?? null;
}

async function ungroupedItems(programId: string): Promise<GroupingItem[]> {
  return db
    .select({
      id: devBacklog.id,
      code: devBacklog.code,
      title: devBacklog.title,
      detail: devBacklog.detail,
      area: devBacklog.area,
      type: devBacklog.type,
      environment: devBacklog.environment,
      priority: devBacklog.priority,
      destination: devBacklog.destination,
      roadmapCode: devBacklog.roadmapCode,
    })
    .from(devBacklog)
    .where(
      and(
        eq(devBacklog.programId, programId),
        eq(devBacklog.status, "aprobada"),
        isNull(devBacklog.groupedAt),
      ),
    )
    .orderBy(asc(devBacklog.createdAt), asc(devBacklog.sortOrder))
    .limit(60);
}

/** Roadmaps sin terminar y módulos activos: a ellos se puede sumar trabajo. */
async function openTargets(programId: string): Promise<OpenTarget[]> {
  const [roadmaps, modules] = await Promise.all([
    db
      .select({
        code: devRoadmaps.code,
        title: devRoadmaps.title,
        kind: devRoadmaps.kind,
      })
      .from(devRoadmaps)
      .where(
        and(
          eq(devRoadmaps.programId, programId),
          ne(devRoadmaps.status, "en_prod"),
        ),
      )
      .orderBy(desc(devRoadmaps.createdAt))
      .limit(30),
    db
      .select({ code: devModules.code, title: devModules.name })
      .from(devModules)
      .where(
        and(
          eq(devModules.programId, programId),
          isNull(devModules.archivedAt),
          sql`${devModules.progress} < 100`,
        ),
      )
      .orderBy(asc(devModules.sortOrder)),
  ]);
  const seen = new Set<string>();
  const out: OpenTarget[] = [];
  for (const t of [
    ...modules.map((m) => ({ ...m, kind: "modulo" })),
    ...roadmaps,
  ]) {
    const key = t.code.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export type GroupingProposal = {
  source: "ia" | "reglas";
  note: string | null;
  groups: ProposedGroup[];
  open: OpenTarget[];
};

/** Propone cómo agrupar las aprobadas sin agrupar. No guarda nada. */
export async function proposeGrouping(
  programId: string,
): Promise<ActionResult<GroupingProposal>> {
  try {
    await requireUser();
    const id = z.string().uuid().parse(programId);
    const program = await programRow(id);
    if (!program) return { ok: false, error: "Programa no encontrado." };
    const [items, open] = await Promise.all([
      ungroupedItems(id),
      openTargets(id),
    ]);
    if (!items.length) {
      return { ok: false, error: "No hay solicitudes aprobadas por agrupar." };
    }
    if (!claudeConfigured()) {
      return {
        ok: true,
        data: {
          source: "reglas",
          note: "Sin IA configurada: agrupación por reglas.",
          groups: fallbackGrouping(items, open),
          open,
        },
      };
    }
    try {
      const { data } = await callClaudeStructured<GroupingOutput>({
        feature: "dev_grouping",
        model:
          process.env.DEV_MINUTES_ANTHROPIC_MODEL?.trim() ||
          "claude-sonnet-5-5",
        effort: process.env.DEV_MINUTES_ANTHROPIC_EFFORT?.trim() || "medium",
        maxTokens: 4_096,
        system: [{ text: GROUPING_SYSTEM_PROMPT, cache: true }],
        input: groupingUserPrompt({ programName: program.name, items, open }),
        schema: groupingOutputSchema,
        timeoutMs: 50_000,
      });
      return {
        ok: true,
        data: {
          source: "ia",
          note: null,
          groups: normalizeGrouping(data, items, open),
          open,
        },
      };
    } catch (err) {
      console.error("[dev-grouping:ia]", err);
      return {
        ok: true,
        data: {
          source: "reglas",
          note: "La IA no respondió: agrupación por reglas.",
          groups: fallbackGrouping(items, open),
          open,
        },
      };
    }
  } catch (err) {
    return handleActionError(err, "dev-tracking/proposeGrouping");
  }
}

const confirmSchema = z.object({
  programId: z.string().uuid(),
  groups: z
    .array(
      z.object({
        kind: z.enum(GROUP_KINDS),
        code: z.string().trim().max(20).nullable().optional(),
        title: z.string().trim().min(3).max(120),
        itemIds: z.array(z.string().uuid()).min(1),
      }),
    )
    .min(1)
    .max(30),
});

/**
 * Confirma la agrupación: reserva los códigos nuevos (R## / NDes-###) de una
 * vez, crea los roadmaps y marca las solicitudes como agrupadas.
 */
export async function confirmGrouping(
  raw: z.input<typeof confirmSchema>,
): Promise<ActionResult<{ codes: string[]; grouped: number }>> {
  try {
    const user = await requireUser();
    const d = confirmSchema.parse(raw);
    const program = await programRow(d.programId);
    if (!program) return { ok: false, error: "Programa no encontrado." };

    const allIds = d.groups.flatMap((g) => g.itemIds);
    if (new Set(allIds).size !== allIds.length) {
      return { ok: false, error: "Una solicitud está en dos grupos." };
    }
    const valid = await db
      .select({ id: devBacklog.id })
      .from(devBacklog)
      .where(
        and(
          eq(devBacklog.programId, program.id),
          inArray(devBacklog.id, allIds),
          eq(devBacklog.status, "aprobada"),
          isNull(devBacklog.groupedAt),
        ),
      );
    if (valid.length !== allIds.length) {
      return {
        ok: false,
        error:
          "Algunas solicitudes ya se agruparon o cambiaron de estado. Vuelve a proponer.",
      };
    }
    const open = await openTargets(program.id);
    const openByCode = new Map(open.map((o) => [o.code.toUpperCase(), o]));
    for (const g of d.groups) {
      if (
        g.kind === "existente" &&
        !openByCode.has((g.code ?? "").toUpperCase())
      ) {
        return {
          ok: false,
          error: `«${g.code ?? "?"}» no es un roadmap o módulo abierto.`,
        };
      }
    }
    const moduleIds = new Map(
      (
        await db
          .select({ id: devModules.id, code: devModules.code })
          .from(devModules)
          .where(eq(devModules.programId, program.id))
      ).map((m) => [m.code.toUpperCase(), m.id]),
    );

    const month = todayLocal().slice(0, 7);
    const now = new Date();
    const codes: string[] = [];
    const logLines: string[] = [];
    for (const g of d.groups) {
      let code: string | null = null;
      let destination = "sin_roadmap";
      if (g.kind === "existente") {
        code = openByCode.get((g.code ?? "").toUpperCase())!.code;
        destination = "roadmap_en_curso";
      } else if (g.kind === "mejora" || g.kind === "modulo") {
        code = await reserveRoadmapCode(program.id, g.kind);
        destination = "nuevo";
        await db
          .insert(devRoadmaps)
          .values({
            programId: program.id,
            code,
            title: g.title,
            month,
            status: "pendiente",
            kind: g.kind,
            createdBy: user.id,
          })
          .onConflictDoNothing();
        codes.push(code);
      }
      await db
        .update(devBacklog)
        .set({
          roadmapCode: code,
          destination,
          moduleId: code ? (moduleIds.get(code.toUpperCase()) ?? null) : null,
          groupedAt: now,
          updatedAt: now,
        })
        .where(inArray(devBacklog.id, g.itemIds));
      logLines.push(
        `${code ?? "Sin roadmap"} · ${g.title} (${g.itemIds.length} solicitud${g.itemIds.length === 1 ? "" : "es"})`,
      );
    }
    await db
      .insert(devLog)
      .values({
        programId: program.id,
        date: todayLocal(),
        text: `Agrupación confirmada: ${logLines.join(" · ")}`,
        source: "manual",
        createdBy: user.id,
      })
      .onConflictDoNothing();
    await logActivity({
      entityType: "dev_program",
      entityId: program.id,
      action: `agrupacion:${allIds.length}`,
      actorId: user.id,
    });
    revalidatePath(`/projects/${program.projectId}/seguimiento`);
    return { ok: true, data: { codes, grouped: allIds.length } };
  } catch (err) {
    return handleActionError(err, "dev-tracking/confirmGrouping");
  }
}

/**
 * Devuelve solicitudes agrupadas (aún no en Asana) a «por agrupar». El código
 * reservado no se recupera: el roadmap queda vacío y puede reusarse eligiéndolo
 * como «roadmap en curso».
 */
export async function ungroupItems(
  ids: string[],
): Promise<ActionResult<{ count: number }>> {
  try {
    await requireUser();
    const clean = z.array(z.string().uuid()).min(1).max(60).parse(ids);
    const rows = await db
      .update(devBacklog)
      .set({ groupedAt: null, updatedAt: new Date() })
      .where(
        and(
          inArray(devBacklog.id, clean),
          eq(devBacklog.status, "aprobada"),
          isNull(devBacklog.asanaTaskGid),
        ),
      )
      .returning({ programId: devBacklog.programId });
    if (rows.length) {
      const p = await programRow(rows[0].programId);
      if (p) revalidatePath(`/projects/${p.projectId}/seguimiento`);
    }
    return { ok: true, data: { count: rows.length } };
  } catch (err) {
    return handleActionError(err, "dev-tracking/ungroupItems");
  }
}
