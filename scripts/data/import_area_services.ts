import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { serviceSubareas, serviceVariants, services } from "@/db/schema";
import { catalogFileSchema, linesToRichText } from "./catalog-file";

/**
 * Importa el catálogo de un área con sus 4 niveles (Start → Enterprise) desde
 * un JSON de noma-ops. Idempotente: actualiza por (área, nombre) y reemplaza
 * las variantes. Si el servicio declara `replaces`, actualiza ese servicio
 * existente en vez de crear uno nuevo (conserva su id y sus propuestas).
 *
 *   npx tsx scripts/data/import_area_services.ts data/normalized/ad_services_2027.json
 *
 * La ruta es relativa a NOMA_DATA_DIR (por defecto ../noma-ops).
 * Con --dry-run solo valida y muestra lo que haría.
 */

const money = (value: number | null) => (value == null ? null : String(value));

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Indica el archivo JSON del catálogo.");
  const opsDir = process.env.NOMA_DATA_DIR ?? "../noma-ops";
  const path = resolve(opsDir, file);
  const catalog = catalogFileSchema.parse(
    JSON.parse(readFileSync(path, "utf8")),
  );
  const { area } = catalog;

  console.log(
    `${dryRun ? "[dry-run] " : ""}Catálogo ${area} · ${catalog.services.length} servicios · ${path}`,
  );
  if (dryRun) {
    for (const s of catalog.services) {
      const tiers = s.variants
        .filter((v) => v.enabled)
        .map((v) => `${v.tier}:${v.priceMinAmount ?? "—"}`)
        .join(" ");
      console.log(
        `  ${s.name}${s.replaces ? ` (reemplaza ${s.replaces})` : ""} · ${tiers}`,
      );
    }
    for (const c of catalog.catalog_changes) {
      console.log(`  cambio: ${c.action} ${c.service}`);
    }
    process.exit(0);
  }

  await db.transaction(async (tx) => {
    for (const subarea of new Set(catalog.services.map((s) => s.subarea))) {
      await tx
        .insert(serviceSubareas)
        .values({ area, name: subarea })
        .onConflictDoNothing();
    }

    for (const item of catalog.services) {
      const start = item.variants.find((v) => v.tier === "START")!;
      const base = {
        name: item.name,
        area,
        subarea: item.subarea,
        description: item.description ?? null,
        requirements: item.requirements ?? null,
        unit: item.unit ?? null,
        status: item.status,
        priceType: "uf" as const,
        priceMinAmount: money(start.priceMinAmount),
        priceMaxAmount: money(start.priceMaxAmount),
        priceCurrency: start.priceCurrency,
        methodology: linesToRichText(start.methodology),
        deliverables: linesToRichText(start.deliverables),
        exclusions: start.exclusions ?? null,
        estimatedTime: start.estimatedTime ?? null,
        sourceFile: catalog.source_file,
        sourceYear: catalog.version.slice(0, 4),
        updatedAt: new Date(),
      };

      const names = [item.name, ...(item.replaces ? [item.replaces] : [])];
      const [existing] = await tx
        .select({ id: services.id })
        .from(services)
        .where(and(eq(services.area, area), inArray(services.name, names)))
        .limit(1);

      let serviceId: string;
      if (existing) {
        await tx.update(services).set(base).where(eq(services.id, existing.id));
        serviceId = existing.id;
        console.log(`  ↻ ${item.name}`);
      } else {
        const [created] = await tx
          .insert(services)
          .values(base)
          .returning({ id: services.id });
        serviceId = created.id;
        console.log(`  + ${item.name}`);
      }

      for (const v of item.variants) {
        const values = {
          serviceId,
          tier: v.tier,
          enabled: v.enabled,
          audience: v.audience ?? null,
          focus: v.focus ?? null,
          description: v.description ?? null,
          methodology: linesToRichText(v.methodology),
          deliverables: linesToRichText(v.deliverables),
          exclusions: v.exclusions ?? null,
          estimatedTime: v.estimatedTime ?? null,
          priceMinAmount: money(v.priceMinAmount),
          priceMaxAmount: money(v.priceMaxAmount),
          priceCurrency: v.priceCurrency,
          updatedAt: new Date(),
        };
        await tx
          .insert(serviceVariants)
          .values(values)
          .onConflictDoUpdate({
            target: [serviceVariants.serviceId, serviceVariants.tier],
            set: values,
          });
      }
    }

    for (const change of catalog.catalog_changes) {
      if (change.action === "move" && change.to_area) {
        if (change.to_subarea) {
          await tx
            .insert(serviceSubareas)
            .values({ area: change.to_area, name: change.to_subarea })
            .onConflictDoNothing();
        }
        const moved = await tx
          .update(services)
          .set({
            area: change.to_area,
            subarea: change.to_subarea ?? null,
            updatedAt: new Date(),
          })
          .where(
            and(eq(services.area, area), eq(services.name, change.service)),
          )
          .returning({ id: services.id });
        console.log(
          `  → ${change.service} a ${change.to_area} (${moved.length})`,
        );
      } else if (change.action === "deactivate") {
        const off = await tx
          .update(services)
          .set({ status: "Inactivo", updatedAt: new Date() })
          .where(
            and(eq(services.area, area), eq(services.name, change.service)),
          )
          .returning({ id: services.id });
        console.log(`  − ${change.service} inactivo (${off.length})`);
      }
    }
  });

  console.log("Listo.");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error importando catálogo:", err);
  process.exit(1);
});
