import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/db";
import { studioConfig, teamMembers, emailTemplates } from "@/db/schema";
import type { NewTeamMember } from "@/db/schema";
import { eq } from "drizzle-orm";
import { seedFinance } from "@/features/finance/seed-finance";

/**
 * Seed base: singleton studio_config + equipo interno (placeholder hasta el sync
 * con GSuite en Fase 6). Los servicios se cargan con `npm run data:import-services`.
 */
const team: NewTeamMember[] = [
  {
    name: "Anna Sanhueza",
    roleTitle: "Directora Creativa",
    photoUrl: "/assets/team/anna-sanhueza.png",
  },
  {
    name: "Sebastián Robles",
    roleTitle: "Director Operativo",
    photoUrl: "/assets/team/sebastian-robles.png",
  },
  {
    name: "Javiera Díaz",
    roleTitle: "Directora de Arte",
    photoUrl: "/assets/team/javiera-diaz.png",
  },
  {
    name: "Catalina Torres",
    roleTitle: "Planner & Art · UX/UI",
    photoUrl: "/assets/team/catalina-torres.png",
  },
  { name: "Luis Salamanca", roleTitle: "Diseñador", photoUrl: null },
  {
    name: "Carlos Leay",
    roleTitle: "Diseñador",
    photoUrl: "/assets/team/carlos-leay.png",
  },
  {
    name: "Maximilian Viveros",
    roleTitle: "Diseñador",
    photoUrl: "/assets/team/maximilian-viveros.png",
  },
  {
    name: "Hector Briceño",
    roleTitle: "Desarrollador",
    photoUrl: "/assets/team/hector-briceno.png",
  },
  {
    name: "Adrián Silva",
    roleTitle: "Diseñador",
    photoUrl: "/assets/team/adrian-silva.png",
  },
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

  const existingTeam = await db.select().from(teamMembers);
  const byName = new Map(existingTeam.map((member) => [member.name, member]));
  for (const member of team) {
    const existing = byName.get(member.name);
    if (existing) {
      await db
        .update(teamMembers)
        .set({
          roleTitle: member.roleTitle,
          photoUrl: member.photoUrl,
          status: "Activo",
        })
        .where(eq(teamMembers.id, existing.id));
    } else {
      await db.insert(teamMembers).values(member);
    }
  }
  console.log(`✓ ${team.length} integrantes del equipo sincronizados`);

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

  // ── Módulo CFO / Finanzas ──────────────────────────────────
  await seedFinance();

  console.log("Seed completado.");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en seed:", err);
  process.exit(1);
});
