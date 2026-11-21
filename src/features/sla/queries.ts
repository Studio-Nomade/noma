import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { slas, slaTemplates } from "@/db/schema";
import type { Area } from "@/types/enums";

export async function getSlaByProposal(proposalId: string) {
  const [row] = await db
    .select()
    .from(slas)
    .where(eq(slas.proposalId, proposalId))
    .limit(1);
  return row ?? null;
}

export async function getSla(id: string) {
  const [row] = await db.select().from(slas).where(eq(slas.id, id)).limit(1);
  return row ?? null;
}

/**
 * Plantilla SLA activa del primer área (en orden) que tenga una. Sin
 * plantilla, el SLA se genera con el texto genérico de `generate.ts`.
 */
export async function getAreaSlaTemplate(areas: readonly Area[]) {
  if (!areas.length) return null;
  const rows = await db
    .select()
    .from(slaTemplates)
    .where(
      and(
        inArray(slaTemplates.area, [...areas]),
        isNull(slaTemplates.serviceId),
        eq(slaTemplates.status, "Activo"),
      ),
    );
  for (const area of areas) {
    const match = rows.find((row) => row.area === area);
    if (match) return match;
  }
  return null;
}

/** Cláusulas propias de cada servicio, indexadas por id de servicio. */
export async function getServiceSlaClauses(serviceIds: string[]) {
  const map = new Map<string, string | null>();
  if (!serviceIds.length) return map;
  const rows = await db
    .select({
      serviceId: slaTemplates.serviceId,
      clauses: slaTemplates.clauses,
    })
    .from(slaTemplates)
    .where(
      and(
        inArray(slaTemplates.serviceId, serviceIds),
        eq(slaTemplates.status, "Activo"),
      ),
    );
  for (const row of rows)
    if (row.serviceId) map.set(row.serviceId, row.clauses);
  return map;
}
