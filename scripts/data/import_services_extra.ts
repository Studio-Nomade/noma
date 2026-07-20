import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import type { NewService } from "@/db/schema";

/**
 * Importa el catálogo curado por área (WD, A&A, A&D, CE, MP) desde
 * scripts/data/services-extra.json → tabla `services`.
 * Idempotente: reemplaza los servicios con el mismo source_file.
 * Valores en borrador (del levantamiento de presupuestos), editables en la UI.
 */
const SOURCE_FILE = "levantamiento-pdf";

type Row = {
  area: NewService["area"];
  name: string;
  subarea?: string;
  description?: string;
  estimated_time?: string;
  price_type: "uf" | "range" | "unit" | "variable";
  currency: "UF" | "CLP";
  price_min?: number;
  price_max?: number;
  unit?: string;
  complexity?: "Light" | "Medium" | "Regular" | "Bold";
};

function toService(r: Row): NewService {
  return {
    name: r.name,
    area: r.area,
    subarea: r.subarea ?? null,
    description: r.description ?? null,
    estimatedTime: r.estimated_time ?? null,
    priceType: r.price_type,
    priceCurrency: r.currency,
    priceMinAmount: r.price_min != null ? String(r.price_min) : null,
    priceMaxAmount: r.price_max != null ? String(r.price_max) : null,
    unit: r.unit ?? null,
    complexityLevel: r.complexity ?? null,
    status: "Activo",
    sourceFile: SOURCE_FILE,
    sourceYear: "2026",
  };
}

async function main() {
  // El catálogo semilla vive en el repo privado noma-ops (ver ADR-public-private-boundary).
  // Configurable con NOMA_DATA_DIR; por defecto asume noma-ops como repo hermano.
  const opsDir = process.env.NOMA_DATA_DIR ?? "../noma-ops";
  const path = resolve(opsDir, "scripts/data/services-extra.json");
  const rows: Row[] = JSON.parse(readFileSync(path, "utf8"));

  const deleted = await db
    .delete(services)
    .where(eq(services.sourceFile, SOURCE_FILE))
    .returning({ id: services.id });

  await db.insert(services).values(rows.map(toService));

  const byArea = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.area] = (acc[r.area] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    `Importados: ${rows.length} servicios (reemplazados ${deleted.length}).`,
  );
  for (const [a, n] of Object.entries(byArea)) console.log(`  ${a}: ${n}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error importando:", err);
  process.exit(1);
});
