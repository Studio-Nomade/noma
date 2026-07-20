import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import type { NewService } from "@/db/schema";

/**
 * Importa los servicios de Branding normalizados desde
 * data/normalized/branding_services.json → tabla `services`.
 *
 * Idempotente: borra primero los servicios con el mismo source_file y los
 * reinserta. UF como valor base; merch en CLP unitario. Uso:
 *   npx tsx scripts/data/import_services.ts
 */

const SOURCE_FILE = "branding_services_master.xlsx";

type Row = {
  subarea: string | null;
  service: string | null;
  description: string | null;
  deliverables: string | null;
  time: string | null;
  unit: string | null;
  price_type: "uf" | "clp_unit" | "sin_valor";
  value_uf_num: number | null;
  value_clp_num: number | null;
};

function toService(r: Row): NewService {
  const base: NewService = {
    name: r.service!.trim(),
    area: "B&D",
    subarea: r.subarea?.trim() || null,
    description: r.description?.trim() || null,
    deliverables: r.deliverables?.trim() || null,
    estimatedTime: r.time?.trim() || null,
    unit: r.unit?.trim() || null,
    status: "Activo",
    sourceFile: SOURCE_FILE,
    sourceYear: "2026",
  };

  if (r.price_type === "uf" && r.value_uf_num != null) {
    return {
      ...base,
      priceType: "uf",
      priceCurrency: "UF",
      priceMinAmount: String(r.value_uf_num),
    };
  }
  if (r.price_type === "clp_unit" && r.value_clp_num != null) {
    return {
      ...base,
      priceType: "unit",
      priceCurrency: "CLP",
      priceMinAmount: String(r.value_clp_num),
    };
  }
  return { ...base, priceType: "variable" };
}

async function main() {
  // El insumo vive en el repo privado noma-ops (ver ADR-public-private-boundary).
  // Configurable con NOMA_DATA_DIR; por defecto asume noma-ops como repo hermano.
  const opsDir = process.env.NOMA_DATA_DIR ?? "../noma-ops";
  const path = resolve(opsDir, "data/normalized/branding_services.json");
  const rows: Row[] = JSON.parse(readFileSync(path, "utf8")).filter(
    (r: Row) => r.service && r.service.trim(),
  );

  const deleted = await db
    .delete(services)
    .where(and(eq(services.area, "B&D"), eq(services.sourceFile, SOURCE_FILE)))
    .returning({ id: services.id });

  const payload = rows.map(toService);
  await db.insert(services).values(payload);

  const bySub = payload.reduce<Record<string, number>>((acc, s) => {
    const k = s.subarea ?? "—";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    `Importados: ${payload.length} servicios B&D (reemplazados ${deleted.length}).`,
  );
  for (const [k, v] of Object.entries(bySub).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(3)}  ${k}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error importando servicios:", err);
  process.exit(1);
});
