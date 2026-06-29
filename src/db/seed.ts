import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/db";
import { studioConfig, services } from "@/db/schema";
import type { NewService } from "@/db/schema";

const demoServices: NewService[] = [
  {
    name: "Identidad visual",
    area: "B&D",
    description:
      "Diseño del sistema de identidad: logotipo, paleta, tipografía y aplicaciones.",
    deliverables: "Manual de marca, logotipo en formatos, paleta, tipografías.",
    estimatedTime: "4–6 semanas",
    priceMinAmount: "40",
    priceMaxAmount: "80",
    priceCurrency: "UF",
  },
  {
    name: "Naming",
    area: "B&D",
    description:
      "Creación del nombre de marca con estrategia y disponibilidad.",
    deliverables: "Propuestas de nombre, rationale, chequeo de disponibilidad.",
    estimatedTime: "2–3 semanas",
    priceMinAmount: "15",
    priceMaxAmount: "30",
    priceCurrency: "UF",
  },
  {
    name: "Landing page",
    area: "WD",
    description: "Página de aterrizaje optimizada para conversión.",
    deliverables: "Diseño UI, desarrollo responsive, publicación.",
    estimatedTime: "3–5 semanas",
    priceMinAmount: "30",
    priceMaxAmount: "60",
    priceCurrency: "UF",
  },
  {
    name: "Sitio web multipágina",
    area: "WD",
    description: "Sitio institucional con CMS editable.",
    deliverables: "Diseño UI, desarrollo, CMS, capacitación.",
    estimatedTime: "6–10 semanas",
    priceMinAmount: "70",
    priceMaxAmount: "140",
    priceCurrency: "UF",
  },
  {
    name: "Anteproyecto arquitectónico",
    area: "A&D",
    description: "Desarrollo de anteproyecto con planimetría y volumetría.",
    deliverables: "Planos, render volumétrico, memoria.",
    estimatedTime: "4–8 semanas",
    priceMinAmount: "50",
    priceMaxAmount: "120",
    priceCurrency: "UF",
  },
  {
    name: "Video institucional",
    area: "A&A",
    description: "Pieza audiovisual de marca.",
    deliverables: "Guion, producción, edición, master final.",
    estimatedTime: "4–6 semanas",
    priceMinAmount: "40",
    priceMaxAmount: "90",
    priceCurrency: "UF",
  },
];

async function main() {
  // studio_config singleton
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

  // services demo
  const existingServices = await db.select().from(services).limit(1);
  if (existingServices.length === 0) {
    await db.insert(services).values(demoServices);
    console.log(`✓ ${demoServices.length} servicios demo cargados`);
  } else {
    console.log("• ya existen servicios, se omite la carga demo");
  }

  console.log("Seed completado.");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en seed:", err);
  process.exit(1);
});
