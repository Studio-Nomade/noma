/**
 * Importa los presupuestos históricos (PDF ya convertidos a texto) como
 * precedentes del cotizador (`proposal_precedents`, source = historico).
 *
 * Insumo en noma-ops:
 *   ${NOMA_DATA_DIR ?? "../noma-ops"}/data/processed/budgets_index.json
 *   ${NOMA_DATA_DIR ?? "../noma-ops"}/data/processed/pdf_text/<ruta>.txt
 *
 * DRY-RUN por defecto. Uso:
 *   npm run quoter:import-precedents                       # revisa
 *   npm run quoter:import-precedents -- --apply            # texto + metadatos
 *   npm run quoter:import-precedents -- --apply --digest   # + resumen y valores con Claude
 *
 * `--digest` usa ANTHROPIC_API_KEY (Claude Sonnet) solo para los que aún no
 * tienen resumen. Idempotente: upsert por ruta del archivo.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { clients, proposalPrecedents } from "@/db/schema";
import { AREAS, type Area } from "@/types/enums";
import { callClaudeStructured } from "@/lib/ai/claude";
import { precedentDigestSchema } from "@/features/quoter/schema";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const digest = args.includes("--digest");
const limitArg = args.includes("--limit")
  ? Number(args[args.indexOf("--limit") + 1])
  : null;

type IndexRow = {
  file: string;
  areas: string[];
  date: string | null;
  code: string | null;
  client: string | null;
  service_title: string | null;
};

const DIGEST_SYSTEM = `Lees el texto extraído de un PDF de presupuesto de Studio Nomade (estudio creativo chileno). El texto viene desordenado (columnas y letras sueltas). Extrae solo lo comercial: cliente, qué se cotizó, cada ítem con su valor (UF o CLP, neto sin IVA), cantidad y unidad, el total neto en UF si se puede, y las condiciones (pago, vigencia, descuentos, "valor original" vs "valor oferta"). Ignora la presentación del estudio, equipo y textos de marketing. No inventes valores: si no hay, null.`;

async function main() {
  const ops = resolve(process.env.NOMA_DATA_DIR ?? "../noma-ops");
  const index = JSON.parse(
    readFileSync(resolve(ops, "data/processed/budgets_index.json"), "utf8"),
  ) as IndexRow[];
  const rows = limitArg ? index.slice(0, limitArg) : index;
  console.log(
    `${apply ? "APLICANDO" : "DRY-RUN (usa --apply para escribir)"}${digest ? " + resumen con Claude" : ""} · ${rows.length} presupuesto(s)\n`,
  );

  let written = 0;
  let digested = 0;
  for (const row of rows) {
    // Los nombres pueden venir en NFC o NFD (tildes) según el sistema que los generó.
    const relative = row.file.replace(/\.pdf$/i, ".txt");
    const txtPath = [
      relative,
      relative.normalize("NFC"),
      relative.normalize("NFD"),
    ]
      .map((candidate) => resolve(ops, "data/processed/pdf_text", candidate))
      .find((candidate) => existsSync(candidate));
    if (!txtPath) {
      console.log(`· sin texto: ${row.file}`);
      continue;
    }
    const rawText = readFileSync(txtPath, "utf8").slice(0, 60_000);
    const areas = (row.areas ?? []).filter((a): a is Area =>
      (AREAS as readonly string[]).includes(a),
    );
    const [client] = row.client
      ? await db
          .select({ id: clients.id })
          .from(clients)
          .where(ilike(clients.companyName, `%${row.client.trim()}%`))
          .limit(1)
      : [];
    const [existing] = await db
      .select({
        id: proposalPrecedents.id,
        summary: proposalPrecedents.summary,
      })
      .from(proposalPrecedents)
      .where(eq(proposalPrecedents.sourceKey, row.file))
      .limit(1);

    const values = {
      source: "historico",
      sourceKey: row.file,
      code: row.code,
      clientName: row.client,
      clientId: client?.id ?? null,
      issuedOn: row.date,
      areas,
      title: row.service_title ?? row.file,
      rawText,
      updatedAt: new Date(),
    };
    console.log(
      `${existing ? "~" : "+"} ${row.code ?? "s/código"} · ${row.client ?? "?"} · ${row.service_title ?? ""}${client ? "" : " (cliente no está en Noma)"}`,
    );
    if (!apply) continue;

    const [saved] = await db
      .insert(proposalPrecedents)
      .values(values)
      .onConflictDoUpdate({ target: proposalPrecedents.sourceKey, set: values })
      .returning({ id: proposalPrecedents.id });
    written++;

    if (digest && !existing?.summary) {
      try {
        const { data } = await callClaudeStructured({
          feature: "quoter_precedent_digest",
          model:
            process.env.QUOTER_LEARNING_MODEL?.trim() || "claude-sonnet-5-5",
          effort: "low",
          maxTokens: 4_000,
          system: [{ text: DIGEST_SYSTEM }],
          input: `Archivo: ${row.file}\n\n${rawText.slice(0, 40_000)}`,
          schema: precedentDigestSchema,
          timeoutMs: 120_000,
        });
        await db
          .update(proposalPrecedents)
          .set({
            clientName: data.client_name ?? row.client,
            title: data.title || values.title,
            summary: data.summary,
            lines: data.lines,
            totalUf: data.total_uf != null ? String(data.total_uf) : null,
            conditions: data.conditions,
            updatedAt: new Date(),
          })
          .where(eq(proposalPrecedents.id, saved.id));
        digested++;
        console.log(
          `    ✓ ${data.lines.length} ítem(s)${data.total_uf != null ? ` · ${data.total_uf} UF` : ""}`,
        );
      } catch (error) {
        console.error(
          `    ✗ resumen: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
  console.log(`\nGuardados: ${written} · resumidos con Claude: ${digested}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
