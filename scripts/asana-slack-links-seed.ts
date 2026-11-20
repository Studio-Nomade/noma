/**
 * Carga/actualiza los vínculos proyecto de Asana ↔ canal de Slack y, con
 * `--people`, la tabla de personas (Asana ↔ Slack por correo).
 *
 * El insumo real vive en noma-ops (dato operativo de clientes):
 *   ${NOMA_DATA_DIR ?? "../noma-ops"}/data/asana-slack-links.json
 * Formato: scripts/asana-slack-links.example.json y
 * src/features/slack-notify/links-config.ts.
 *
 * DRY-RUN por defecto (no escribe). Uso:
 *   npm run slack:seed-links                      # dry-run
 *   npm run slack:seed-links -- --example         # valida el ejemplo
 *   npm run slack:seed-links -- --apply           # escribe en DATABASE_URL
 *   npm run slack:seed-links -- --apply --reset   # también pisa active/events
 *   npm run slack:seed-links -- --people --apply  # personas Asana ↔ Slack
 *
 * Idempotente: upsert por proyecto de Asana. Sin `--reset`, un vínculo que ya
 * existe conserva su `active` y sus eventos (los que se cambian en Noma).
 * `--people` necesita ASANA_ACCESS_TOKEN, ASANA_WORKSPACE_GID y
 * SLACK_BOT_TOKEN (permiso users:read.email).
 *
 * Corre con `--conditions=react-server` (ver package.json) porque reutiliza
 * módulos marcados `server-only`.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { asanaSlackLinks, peopleIdentities } from "@/db/schema";
import { listWorkspaceUsers } from "@/features/asana/asana";
import {
  linkEvents,
  slackLinksFileSchema,
} from "@/features/slack-notify/links-config";
import { lookupSlackUserByEmail } from "@/features/slack-notify/slack-bot";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const reset = args.includes("--reset");

function configPath() {
  if (args.includes("--example")) {
    return resolve("scripts/asana-slack-links.example.json");
  }
  const fileArg = args.includes("--file")
    ? args[args.indexOf("--file") + 1]
    : null;
  if (fileArg) return resolve(fileArg);
  const opsDir = process.env.NOMA_DATA_DIR ?? "../noma-ops";
  return resolve(opsDir, "data/asana-slack-links.json");
}

async function seedLinks() {
  const path = configPath();
  const parsed = slackLinksFileSchema.safeParse(
    JSON.parse(readFileSync(path, "utf8")),
  );
  if (!parsed.success) {
    console.error(`✗ ${path} no es válido:`);
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  const { links } = parsed.data;
  console.log(
    `${apply ? "APLICANDO" : "DRY-RUN (usa --apply para escribir)"} · ${links.length} vínculo(s) desde ${path}\n`,
  );
  for (const link of links) {
    console.log(
      `• ${link.asana_project_name} (${link.asana_project_gid}) → #${link.slack_channel_name} (${link.slack_channel_id})${link.active ? "" : " · por confirmar (apagado)"}`,
    );
    if (!apply) continue;
    const values = {
      asanaProjectGid: link.asana_project_gid,
      asanaProjectName: link.asana_project_name,
      slackChannelId: link.slack_channel_id,
      slackChannelName: link.slack_channel_name,
      folioPrefix: link.folio_prefix ?? null,
      events: linkEvents(link),
      active: link.active,
    };
    await db
      .insert(asanaSlackLinks)
      .values(values)
      .onConflictDoUpdate({
        target: asanaSlackLinks.asanaProjectGid,
        set: {
          asanaProjectName: values.asanaProjectName,
          slackChannelId: values.slackChannelId,
          slackChannelName: values.slackChannelName,
          folioPrefix: values.folioPrefix,
          ...(reset ? { events: values.events, active: values.active } : {}),
          updatedAt: sql`now()`,
        },
      });
  }
}

async function seedPeople() {
  const workspaceGid = process.env.ASANA_WORKSPACE_GID?.trim();
  if (!workspaceGid) throw new Error("Falta ASANA_WORKSPACE_GID.");
  const users = (await listWorkspaceUsers(workspaceGid)).filter(
    (user) => user.email,
  );
  console.log(
    `\n${apply ? "APLICANDO" : "DRY-RUN"} · ${users.length} persona(s) de Asana con correo\n`,
  );
  let matched = 0;
  for (const user of users) {
    const email = user.email!.trim().toLowerCase();
    const slackUserId = await lookupSlackUserByEmail(email).catch(() => null);
    if (slackUserId) matched++;
    console.log(
      `• ${user.name ?? email} → ${slackUserId ?? "sin usuario en Slack"}`,
    );
    if (!apply) continue;
    await db
      .insert(peopleIdentities)
      .values({ email, asanaUserGid: user.gid, slackUserId })
      .onConflictDoUpdate({
        target: peopleIdentities.email,
        set: {
          asanaUserGid: user.gid,
          ...(slackUserId ? { slackUserId } : {}),
          updatedAt: sql`now()`,
        },
      });
  }
  console.log(`\n${matched}/${users.length} con usuario de Slack.`);
}

async function main() {
  if (args.includes("--people")) await seedPeople();
  else await seedLinks();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
