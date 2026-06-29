import { asc, desc, eq, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema";

export async function listEmailTemplates() {
  return db
    .select()
    .from(emailTemplates)
    .orderBy(desc(emailTemplates.isDefault), asc(emailTemplates.name));
}

/** Plantillas activas para un área (incluye las globales sin área). */
export async function listTemplatesForArea(area: string) {
  return db
    .select()
    .from(emailTemplates)
    .where(
      or(eq(emailTemplates.area, area as never), isNull(emailTemplates.area)),
    )
    .orderBy(desc(emailTemplates.isDefault), asc(emailTemplates.name));
}
