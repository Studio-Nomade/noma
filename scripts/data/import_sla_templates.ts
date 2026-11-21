import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { services, slaTemplates } from "@/db/schema";
import { slaTemplateFileSchema, undeclaredVariables } from "./catalog-file";

/**
 * Importa la plantilla SLA estándar de un área y las cláusulas por servicio
 * desde un JSON de noma-ops. Idempotente: una plantilla por área y una fila de
 * cláusulas por servicio. Los servicios se buscan por (área, nombre), así que
 * conviene importar antes el catálogo del área.
 *
 *   npx tsx scripts/data/import_sla_templates.ts data/normalized/ad_sla_templates.json
 *
 * La ruta es relativa a NOMA_DATA_DIR (por defecto ../noma-ops).
 * Con --dry-run solo valida.
 */

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Indica el archivo JSON de la plantilla.");
  const opsDir = process.env.NOMA_DATA_DIR ?? "../noma-ops";
  const path = resolve(opsDir, file);
  const tpl = slaTemplateFileSchema.parse(
    JSON.parse(readFileSync(path, "utf8")),
  );

  const undeclared = undeclaredVariables(tpl);
  if (undeclared.length) {
    throw new Error(`Variables sin declarar: ${undeclared.join(", ")}`);
  }
  console.log(
    `${dryRun ? "[dry-run] " : ""}${tpl.name} · ${tpl.sections.length} secciones · ${tpl.services.length} servicios`,
  );
  if (dryRun) process.exit(0);

  await db.transaction(async (tx) => {
    const areaValues = {
      area: tpl.area,
      serviceId: null,
      name: tpl.name,
      sections: tpl.sections,
      serviceBlock: tpl.service_block,
      variables: tpl.variables,
      clauses: null,
      status: "Activo" as const,
      sourceFile: file,
      updatedAt: new Date(),
    };
    const [current] = await tx
      .select({ id: slaTemplates.id })
      .from(slaTemplates)
      .where(
        and(eq(slaTemplates.area, tpl.area), isNull(slaTemplates.serviceId)),
      )
      .limit(1);
    if (current) {
      await tx
        .update(slaTemplates)
        .set(areaValues)
        .where(eq(slaTemplates.id, current.id));
    } else {
      await tx.insert(slaTemplates).values(areaValues);
    }

    for (const item of tpl.services) {
      const [service] = await tx
        .select({ id: services.id })
        .from(services)
        .where(
          and(eq(services.area, tpl.area), eq(services.name, item.service)),
        )
        .limit(1);
      if (!service) {
        console.warn(
          `  ! Servicio no encontrado en ${tpl.area}: ${item.service}`,
        );
        continue;
      }
      const values = {
        area: tpl.area,
        serviceId: service.id,
        name: `${tpl.name} · ${item.service}`,
        sections: [],
        serviceBlock: null,
        variables: [],
        clauses: item.clauses,
        status: "Activo" as const,
        sourceFile: file,
        updatedAt: new Date(),
      };
      const [existing] = await tx
        .select({ id: slaTemplates.id })
        .from(slaTemplates)
        .where(eq(slaTemplates.serviceId, service.id))
        .limit(1);
      if (existing) {
        await tx
          .update(slaTemplates)
          .set(values)
          .where(eq(slaTemplates.id, existing.id));
      } else {
        await tx.insert(slaTemplates).values(values);
      }
      console.log(`  ✓ ${item.service}`);
    }
  });

  console.log("Listo.");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error importando plantilla SLA:", err);
  process.exit(1);
});
