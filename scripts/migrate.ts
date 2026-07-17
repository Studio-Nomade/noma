/**
 * Migrador seguro (compatible con Drizzle) — aplica las migraciones de
 * `src/db/migrations` una a una, ejecutando cada sentencia en autocommit.
 *
 * ¿Por qué no `drizzle-kit migrate`? Ese comando envuelve TODAS las migraciones
 * pendientes en una sola transacción. Postgres prohíbe usar un valor de enum
 * recién agregado (`ALTER TYPE ... ADD VALUE`) dentro de la misma transacción
 * (error 55P04). Al aplicarse contra una base nueva, la corrida completa falla.
 * Este script ejecuta sentencia por sentencia (cada una hace commit), por lo que
 * un `ADD VALUE` queda confirmado antes de que otra migración lo use.
 *
 * Es compatible con el tracking de Drizzle: usa `drizzle.__drizzle_migrations`
 * con el mismo hash (sha256 del archivo .sql) y `created_at` (= journal `when`).
 * Así, alternar con `drizzle-kit` no reaplica migraciones ya registradas.
 *
 * Uso:
 *   DEV local:  npm run db:migrate         (lee .env.local)
 *   PROD/CI:    DATABASE_URL=... npm run db:deploy
 */
import { config } from "dotenv";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

// En local carga .env.local; en CI las variables ya vienen del entorno.
config({ path: ".env.local" });

const MIGRATIONS_DIR = path.resolve("src/db/migrations");

type JournalEntry = { idx: number; when: number; tag: string; breakpoints: boolean };

/**
 * Lee DATABASE_URL tolerando comillas y espacios: al copiar el valor desde
 * `.env.local` (que lo guarda entrecomillado) o desde un dashboard, es fácil
 * arrastrarlos, y `postgres()` falla con un opaco "TypeError: Invalid URL"
 * sin decir cuál es el problema (el valor va enmascarado en los logs de CI).
 */
function readDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL no está definido.");

  const url = raw.trim().replace(/^['"]|['"]$/g, "").trim();
  if (!/^postgres(ql)?:\/\/\S+@\S+/.test(url)) {
    throw new Error(
      "DATABASE_URL no es una connection string válida. Debe tener la forma " +
        "postgresql://USUARIO:CONTRASEÑA@HOST:PUERTO/postgres — revisa que no " +
        "lleve comillas ni saltos de línea, y que los caracteres especiales de " +
        "la contraseña estén percent-encoded (@ → %40, # → %23, etc.).",
    );
  }
  return url;
}

async function main() {
  const url = readDatabaseUrl();

  const journalPath = path.join(MIGRATIONS_DIR, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries: JournalEntry[];
  };

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await sql.unsafe(
      `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )`,
    );

    const rows = await sql<{ max: string | null }[]>`
      SELECT max(created_at)::text AS max FROM drizzle.__drizzle_migrations
    `;
    const lastApplied = rows[0]?.max ? Number(rows[0].max) : -1;

    const pending = journal.entries
      .filter((e) => e.when > lastApplied)
      .sort((a, b) => a.when - b.when);

    if (pending.length === 0) {
      console.log("✓ Sin migraciones pendientes.");
      return;
    }

    for (const entry of pending) {
      const filePath = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
      const content = fs.readFileSync(filePath, "utf8");
      const hash = crypto.createHash("sha256").update(content).digest("hex");
      const statements = content
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);

      process.stdout.write(`→ ${entry.tag} (${statements.length} sentencias)… `);
      for (const stmt of statements) {
        await sql.unsafe(stmt); // autocommit: sin transacción envolvente
      }
      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${entry.when})
      `;
      console.log("ok");
    }
    console.log(`✓ ${pending.length} migración(es) aplicada(s).`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗ Error aplicando migraciones:\n", err);
  process.exit(1);
});
