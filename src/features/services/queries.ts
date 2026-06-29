import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";

export async function listServices() {
  return db
    .select()
    .from(services)
    .orderBy(asc(services.area), asc(services.name));
}

export async function getService(id: string) {
  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, id))
    .limit(1);
  return service ?? null;
}

/** Servicios activos de un área (para alimentar propuestas en Fase 4). */
export async function listActiveServicesByArea(area: string) {
  return db
    .select()
    .from(services)
    .where(eq(services.area, area as never))
    .orderBy(asc(services.name));
}
