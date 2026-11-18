import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { devPrograms } from "@/db/schema";

/**
 * Noma es la única fuente del siguiente número de roadmap del programa:
 * `R##` para mejoras y correcciones, `NDes-###` para módulos nuevos. Reserva
 * atómica (UPDATE … RETURNING), así dos procesos no toman el mismo número.
 */
export async function reserveRoadmapCode(
  programId: string,
  kind: "mejora" | "correccion" | "modulo",
): Promise<string> {
  if (kind === "modulo") {
    const [row] = await db
      .update(devPrograms)
      .set({
        nextModuleNumber: sql`${devPrograms.nextModuleNumber} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(devPrograms.id, programId))
      .returning({ n: devPrograms.nextModuleNumber });
    if (!row) throw new Error("Programa no encontrado.");
    return `NDes-${String(row.n - 1).padStart(3, "0")}`;
  }
  const [row] = await db
    .update(devPrograms)
    .set({
      nextRoadmapNumber: sql`${devPrograms.nextRoadmapNumber} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(devPrograms.id, programId))
    .returning({ n: devPrograms.nextRoadmapNumber });
  if (!row) throw new Error("Programa no encontrado.");
  return `R${row.n - 1}`;
}

/** Vista previa del siguiente código sin reservarlo. */
export async function peekRoadmapCode(programId: string) {
  const [row] = await db
    .select({
      r: devPrograms.nextRoadmapNumber,
      n: devPrograms.nextModuleNumber,
    })
    .from(devPrograms)
    .where(eq(devPrograms.id, programId))
    .limit(1);
  if (!row) return null;
  return {
    mejora: `R${row.r}`,
    modulo: `NDes-${String(row.n).padStart(3, "0")}`,
  };
}
