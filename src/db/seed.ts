import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/db";
import { studioConfig } from "@/db/schema";

/**
 * Seed mínimo: solo el singleton studio_config.
 * Los servicios reales se cargan con `npm run data:import-services`
 * (desde data/normalized/branding_services.json).
 */
async function main() {
  const existing = await db.select().from(studioConfig).limit(1);
  if (existing.length === 0) {
    await db.insert(studioConfig).values({
      studioName: "Studio Nomade",
      tagline: "Creatividad con propósito",
    });
    console.log("✓ studio_config creado");
  } else {
    console.log("• studio_config ya existe, se omite");
  }
  console.log("Seed completado.");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en seed:", err);
  process.exit(1);
});
