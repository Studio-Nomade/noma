/**
 * Registra (idempotente) un webhook de Asana por proyecto de los canales de
 * correo activos, apuntando a <base>/api/webhooks/asana?project=<gid>.
 *
 * Requisitos: ASANA_ACCESS_TOKEN, ASANA_WORKSPACE_GID, DATABASE_URL de la
 * MISMA base que usa el deploy (el handshake lo recibe el deploy y guarda el
 * secreto cifrado ahí) y NOMA_TOKEN_ENCRYPTION_KEY. El deploy debe estar
 * arriba con la migración aplicada.
 *
 * DRY-RUN por defecto. Uso:
 *   npm run asana:register-webhooks -- --base-url https://noma.example.cl
 *   npm run asana:register-webhooks -- --base-url ... --project 1200000000000001
 *   npm run asana:register-webhooks -- --base-url ... --apply
 *   npm run asana:register-webhooks -- --base-url ... --apply --force   # recrea
 *   npm run asana:register-webhooks -- --base-url ... --apply --filters --project <gid>,<gid>
 *
 * `--filters` solo actualiza los filtros de los webhooks activos que ya
 * apuntan a ese target (PUT, sin handshake): no lee ni escribe la base y nunca
 * recrea un webhook, así que se puede correr con cualquier DATABASE_URL.
 *
 * Corre con `--conditions=react-server` (ver package.json) porque reutiliza
 * módulos marcados `server-only`.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailChannels } from "@/db/schema";
import {
  createWebhook,
  deleteWebhook,
  listWebhooks,
  updateWebhookFilters,
  type AsanaWebhookInfo,
} from "@/features/asana/asana";
import {
  completeRegistration,
  failRegistration,
  listRegisteredWebhooks,
  prepareRegistration,
} from "@/features/asana/webhook-store";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const force = args.includes("--force");
// Actualiza los filtros de los webhooks sanos sin recrearlos (sin handshake).
const filtersOnly = args.includes("--filters");
const argValue = (name: string) =>
  args.includes(name) ? (args[args.indexOf(name) + 1] ?? null) : null;

async function main() {
  const baseUrl = (
    argValue("--base-url") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    ""
  ).replace(/\/$/, "");
  if (!/^https:\/\//.test(baseUrl)) {
    throw new Error(
      "Indica --base-url https://<deploy> (Asana exige HTTPS público).",
    );
  }
  const workspaceGid = process.env.ASANA_WORKSPACE_GID?.trim();
  if (!workspaceGid) throw new Error("Falta ASANA_WORKSPACE_GID.");

  const onlyProject = argValue("--project");
  if (filtersOnly) {
    if (!onlyProject) {
      throw new Error("Con --filters indica --project <gid>[,<gid>…].");
    }
    await updateFilters(baseUrl, workspaceGid, onlyProject.split(","));
    process.exit(0);
  }
  const projectGids = onlyProject
    ? [onlyProject]
    : [
        ...new Set(
          (
            await db
              .select({ gid: emailChannels.asanaProjectGid })
              .from(emailChannels)
              .where(eq(emailChannels.status, "active"))
          ).map((row) => row.gid),
        ),
      ];
  if (!projectGids.length) {
    console.log("No hay canales de correo activos.");
    process.exit(0);
  }

  const registered = new Map(
    (await listRegisteredWebhooks()).map((row) => [row.asanaProjectGid, row]),
  );
  console.log(
    `${apply ? "APLICANDO" : "DRY-RUN (usa --apply para registrar)"} · ${projectGids.length} proyecto(s)\n`,
  );

  for (const projectGid of projectGids) {
    const target = `${baseUrl}/api/webhooks/asana?project=${projectGid}`;
    const existing: AsanaWebhookInfo[] = await listWebhooks(
      workspaceGid,
      projectGid,
    );
    const sameTarget = existing.filter((hook) => hook.target === target);
    const local = registered.get(projectGid);
    const healthy =
      sameTarget.some((hook) => hook.active) &&
      local?.status === "active" &&
      Boolean(local.secret);

    console.log(`• ${projectGid} → ${target}`);
    console.log(
      `  Asana: ${existing.length} webhook(s), ${sameTarget.length} con este target · Noma: ${local?.status ?? "sin registro"}`,
    );
    if (healthy && !force) {
      console.log("  ✓ ya registrado (sin cambios)");
      continue;
    }
    if (!apply) {
      console.log(
        `  → se ${sameTarget.length ? "recrearía" : "crearía"} el webhook`,
      );
      continue;
    }

    // Sin el secreto local no se pueden validar firmas: se recrea.
    for (const hook of sameTarget) {
      await deleteWebhook(hook.gid);
      console.log(`  - eliminado webhook previo ${hook.gid}`);
    }
    await prepareRegistration(projectGid);
    let created: Awaited<ReturnType<typeof createWebhook>>;
    try {
      created = await createWebhook(projectGid, target);
    } catch (error) {
      await failRegistration(projectGid);
      throw error;
    }
    await completeRegistration(projectGid, created.gid);
    console.log(`  ✓ webhook ${created.gid} activo`);
  }
  process.exit(0);
}

/** Solo filtros: PUT a los webhooks activos con este target. Sin base. */
async function updateFilters(
  baseUrl: string,
  workspaceGid: string,
  projectGids: string[],
) {
  console.log(
    `${apply ? "APLICANDO" : "DRY-RUN (usa --apply)"} · solo filtros · ${projectGids.length} proyecto(s)\n`,
  );
  for (const raw of projectGids) {
    const projectGid = raw.trim();
    if (!/^\d{1,32}$/.test(projectGid)) {
      console.log(`• ${raw}: gid inválido, se omite`);
      continue;
    }
    const target = `${baseUrl}/api/webhooks/asana?project=${projectGid}`;
    const active = (await listWebhooks(workspaceGid, projectGid)).filter(
      (hook) => hook.target === target && hook.active,
    );
    console.log(`• ${projectGid} → ${target}`);
    if (!active.length) {
      console.log(
        "  ✗ sin webhook activo con este target (no se crea ni se recrea)",
      );
      continue;
    }
    for (const hook of active) {
      if (!apply) {
        console.log(`  → se actualizarían los filtros de ${hook.gid}`);
        continue;
      }
      await updateWebhookFilters(hook.gid);
      console.log(`  ✓ filtros actualizados en ${hook.gid}`);
    }
  }
}

main().catch((error) => {
  console.error(
    "✗ Error registrando webhooks:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
