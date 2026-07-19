import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Conexión perezosa: no se crea (ni exige DATABASE_URL) hasta el primer uso.
 * Esto permite construir/importar sin la variable presente (p. ej. en build).
 */
const globalForDb = globalThis as unknown as {
  __noma_pool?: Pool;
  __noma_db?: NodePgDatabase<typeof schema>;
};

function getDb(): NodePgDatabase<typeof schema> {
  if (globalForDb.__noma_db) return globalForDb.__noma_db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL no está definido. Copia .env.example a .env.local y complétalo.",
    );
  }

  const isProductionBuild =
    process.env.NEXT_PHASE === "phase-production-build";
  const pool =
    globalForDb.__noma_pool ??
    new Pool({
      connectionString,
      // El build genera páginas en paralelo. En Fluid Compute usamos tres
      // conexiones para evitar que una transacción larga bloquee todo el sitio,
      // manteniendo el consumo muy por debajo del límite de Supabase.
      max: isProductionBuild ? 10 : 3,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 5_000,
      maxLifetimeSeconds: 60,
      statement_timeout: 30_000,
      query_timeout: 35_000,
      allowExitOnIdle: true,
    });
  const instance = drizzle(pool, { schema });

  // Fluid Compute mantiene instancias cálidas. Este hook evita que Vercel las
  // congele con sockets ociosos que después se reanuden en estado inválido.
  if (process.env.VERCEL && !isProductionBuild) attachDatabasePool(pool);

  globalForDb.__noma_pool = pool;
  globalForDb.__noma_db = instance;
  return instance;
}

// Proxy que difiere la conexión real al primer acceso a una propiedad.
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    const instance = getDb();
    const value = instance[prop as keyof typeof instance];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
