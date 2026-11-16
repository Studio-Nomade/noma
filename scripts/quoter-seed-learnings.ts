/**
 * Carga la memoria inicial del cotizador (reglas aprendidas en los chats de
 * cotización con Claude) en `quoter_learnings`.
 *
 * El insumo real vive en noma-ops (criterios comerciales y valores reales):
 *   ${NOMA_DATA_DIR ?? "../noma-ops"}/data/quoter/learnings-seed.json
 * Formato: { rules: [{ kind, scope, area, service_name, client_name, industry,
 *   statement, rationale, active }] }
 *
 * DRY-RUN por defecto. Uso:
 *   npm run quoter:seed-learnings              # revisa
 *   npm run quoter:seed-learnings -- --apply   # escribe en DATABASE_URL
 *
 * Idempotente: no duplica reglas con el mismo enunciado.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, quoterLearnings, services } from "@/db/schema";
import {
  AREAS,
  QUOTER_LEARNING_KINDS,
  QUOTER_LEARNING_SCOPES,
} from "@/types/enums";

const apply = process.argv.includes("--apply");

const fileSchema = z.object({
  rules: z.array(
    z.object({
      kind: z.enum(QUOTER_LEARNING_KINDS),
      scope: z.enum(QUOTER_LEARNING_SCOPES),
      area: z.enum(AREAS).nullable().optional(),
      service_name: z.string().nullable().optional(),
      client_name: z.string().nullable().optional(),
      industry: z.string().nullable().optional(),
      statement: z.string().min(8),
      rationale: z.string().nullable().optional(),
      active: z.boolean().default(true),
    }),
  ),
});

async function main() {
  const path = resolve(
    process.env.NOMA_DATA_DIR ?? "../noma-ops",
    "data/quoter/learnings-seed.json",
  );
  const { rules } = fileSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  console.log(
    `${apply ? "APLICANDO" : "DRY-RUN (usa --apply para escribir)"} · ${rules.length} regla(s) desde ${path}\n`,
  );

  let created = 0;
  let skipped = 0;
  for (const rule of rules) {
    const [exists] = await db
      .select({ id: quoterLearnings.id })
      .from(quoterLearnings)
      .where(eq(quoterLearnings.statement, rule.statement.trim()))
      .limit(1);
    if (exists) {
      skipped++;
      continue;
    }
    let scope = rule.scope;
    let serviceId: string | null = null;
    let clientId: string | null = null;
    const notes: string[] = [];
    if (scope === "servicio") {
      const [service] = rule.service_name
        ? await db
            .select({ id: services.id })
            .from(services)
            .where(ilike(services.name, rule.service_name.trim()))
            .limit(1)
        : [];
      if (service) serviceId = service.id;
      else {
        scope = rule.area ? "area" : "global";
        notes.push(`servicio «${rule.service_name}» no encontrado → ${scope}`);
      }
    }
    if (scope === "cliente") {
      const [client] = rule.client_name
        ? await db
            .select({ id: clients.id })
            .from(clients)
            .where(ilike(clients.companyName, `%${rule.client_name.trim()}%`))
            .limit(1)
        : [];
      if (client) clientId = client.id;
      else
        notes.push(
          `cliente «${rule.client_name}» no encontrado (queda sin vincular; no se aplicará)`,
        );
    }
    console.log(
      `${rule.active ? "+" : "·"} [${rule.kind}/${scope}] ${rule.statement.slice(0, 110)}${notes.length ? `\n    ⚠ ${notes.join("; ")}` : ""}`,
    );
    if (apply) {
      await db.insert(quoterLearnings).values({
        kind: rule.kind,
        scope,
        area: scope === "area" ? (rule.area ?? null) : (rule.area ?? null),
        serviceId,
        clientId,
        industry: scope === "rubro" ? (rule.industry ?? null) : null,
        statement: rule.statement.trim(),
        rationale: rule.rationale?.trim() || null,
        origin: "equipo",
        active: rule.active && !(scope === "cliente" && !clientId),
        createdByEmail: "seed:noma-ops",
      });
    }
    created++;
  }
  console.log(
    `\n${apply ? "Creadas" : "Se crearían"}: ${created} · ya existían: ${skipped}`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
