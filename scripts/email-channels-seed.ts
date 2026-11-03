/**
 * Carga/actualiza los canales de correo (alias → cliente/proyecto/Asana).
 *
 * El insumo real vive en noma-ops (dato operativo de clientes):
 *   ${NOMA_DATA_DIR ?? "../noma-ops"}/data/email-channels.json
 * Formato: ver scripts/email-channels.example.json y
 * src/features/email/channel-config.ts.
 *
 * DRY-RUN por defecto (no escribe). Uso:
 *   npm run email:seed-channels                    # dry-run
 *   npm run email:seed-channels -- --file x.json   # otro archivo
 *   npm run email:seed-channels -- --example       # valida el ejemplo
 *   npm run email:seed-channels -- --apply         # escribe en DATABASE_URL
 *
 * Idempotente: upsert por alias. `folio_start` solo fija el contador si el
 * prefijo aún no tiene folios emitidos.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailChannels, folioCounters, projects } from "@/db/schema";
import {
  emailChannelsFileSchema,
  type EmailChannelConfig,
} from "@/features/email/channel-config";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const fileArg = args.includes("--file")
  ? args[args.indexOf("--file") + 1]
  : null;

function configPath() {
  if (args.includes("--example")) {
    return resolve("scripts/email-channels.example.json");
  }
  if (fileArg) return resolve(fileArg);
  const opsDir = process.env.NOMA_DATA_DIR ?? "../noma-ops";
  return resolve(opsDir, "data/email-channels.json");
}

async function resolveTarget(channel: EmailChannelConfig) {
  if (channel.client_id && channel.project_id) {
    return { clientId: channel.client_id, projectId: channel.project_id };
  }
  const matches = await db
    .select({
      id: projects.id,
      clientId: projects.clientId,
      name: projects.name,
    })
    .from(projects)
    .where(eq(projects.asanaProjectGid, channel.asana_project_gid));
  if (matches.length !== 1) {
    throw new Error(
      `${channel.alias}: ${matches.length} proyectos con asana_project_gid=${channel.asana_project_gid}. Define client_id y project_id en el archivo.`,
    );
  }
  return { clientId: matches[0].clientId, projectId: matches[0].id };
}

async function main() {
  const path = configPath();
  const parsed = emailChannelsFileSchema.safeParse(
    JSON.parse(readFileSync(path, "utf8")),
  );
  if (!parsed.success) {
    console.error(`✗ ${path} no es válido:`);
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  const { channels } = parsed.data;
  console.log(
    `${apply ? "APLICANDO" : "DRY-RUN (usa --apply para escribir)"} · ${channels.length} canal(es) desde ${path}\n`,
  );

  const hasDb = Boolean(process.env.DATABASE_URL);
  for (const channel of channels) {
    console.log(
      `• ${channel.alias} → Asana ${channel.asana_project_gid} · folio ${channel.folio_prefix}-#### · sección ${
        channel.section_strategy === "fixed"
          ? `fija ${channel.fixed_section_gid}`
          : `mensual "${channel.month_section_template}"`
      } · dominios [${channel.allowed_sender_domains.join(", ")}]${
        channel.domains_to_confirm ? " (POR CONFIRMAR)" : ""
      } · ${channel.status}`,
    );
    if (!hasDb) {
      console.log("  (sin DATABASE_URL: no se resuelve cliente/proyecto)");
      continue;
    }
    let target: { clientId: string; projectId: string };
    try {
      target = await resolveTarget(channel);
      console.log(
        `  cliente ${target.clientId} · proyecto ${target.projectId}`,
      );
    } catch (error) {
      console.error(`  ✗ ${error instanceof Error ? error.message : error}`);
      if (apply) process.exitCode = 1;
      continue;
    }
    if (!apply) continue;

    const values = {
      alias: channel.alias,
      clientId: target.clientId,
      projectId: target.projectId,
      asanaProjectGid: channel.asana_project_gid,
      sectionStrategy: channel.section_strategy,
      fixedSectionGid: channel.fixed_section_gid ?? null,
      monthSectionTemplate: channel.month_section_template,
      defaultAssigneeGid: channel.default_assignee_gid ?? null,
      folioPrefix: channel.folio_prefix,
      allowedSenderDomains: channel.allowed_sender_domains,
      status: channel.status,
      updatedAt: new Date(),
    };
    await db
      .insert(emailChannels)
      .values(values)
      .onConflictDoUpdate({ target: emailChannels.alias, set: values });
    if (channel.folio_start) {
      await db
        .insert(folioCounters)
        .values({
          prefix: channel.folio_prefix,
          lastNumber: channel.folio_start - 1,
        })
        .onConflictDoNothing({ target: folioCounters.prefix });
    }
    console.log("  ✓ guardado");
  }
  process.exit(process.exitCode ?? 0);
}

main().catch((error) => {
  console.error("✗ Error cargando canales:", error);
  process.exit(1);
});
