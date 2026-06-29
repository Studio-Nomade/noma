import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * Ejecuta un archivo .sql contra la base (uso: tsx scripts/apply-sql.ts <ruta>).
 * Útil para aplicar políticas RLS u otros scripts puntuales.
 */
async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Uso: tsx scripts/apply-sql.ts <ruta-al-sql>");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no definido");

  const sqlText = readFileSync(file, "utf8");
  const sql = postgres(url, { prepare: false });
  await sql.unsafe(sqlText);
  await sql.end();
  console.log(`✓ Aplicado: ${file}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error aplicando SQL:", err);
  process.exit(1);
});
