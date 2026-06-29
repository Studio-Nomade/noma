import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/db";
import { studioConfig, teamMembers, emailTemplates } from "@/db/schema";
import type { NewTeamMember } from "@/db/schema";

/**
 * Seed base: singleton studio_config + equipo interno (placeholder hasta el sync
 * con GSuite en Fase 6). Los servicios se cargan con `npm run data:import-services`.
 */
const team: NewTeamMember[] = [
  { name: "Anna Sanhueza", notes: "Dirección Creativa" },
  { name: "Sebastián Robles", notes: "Dirección Operativa" },
  { name: "Javiera Díaz", notes: "Directora de Arte" },
  { name: "Catalina Torres", notes: "Planner & Art · UX/UI" },
  { name: "Adrián Silva", notes: "Diseñador" },
];

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

  const existingTeam = await db.select().from(teamMembers).limit(1);
  if (existingTeam.length === 0) {
    await db.insert(teamMembers).values(team);
    console.log(`✓ ${team.length} integrantes del equipo cargados`);
  } else {
    console.log("• team_members ya tiene datos, se omite");
  }

  const existingTpl = await db.select().from(emailTemplates).limit(1);
  if (existingTpl.length === 0) {
    await db.insert(emailTemplates).values({
      name: "Envío de propuesta",
      subject: "Propuesta Comercial · {{proyecto}}",
      isDefault: true,
      body: `Hola {{contacto}},

Junto con saludar, adjuntamos la propuesta comercial para {{proyecto}}.
El valor total considerado es {{total}}.

Quedamos atentos a tus comentarios.

Saludos,
{{remitente}}
Studio Nomade`,
    });
    console.log("✓ plantilla de correo por defecto creada");
  } else {
    console.log("• email_templates ya tiene datos, se omite");
  }

  console.log("Seed completado.");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en seed:", err);
  process.exit(1);
});
