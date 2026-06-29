import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Conexión perezosa: no se crea (ni exige DATABASE_URL) hasta el primer uso.
 * Esto permite construir/importar sin la variable presente (p. ej. en build).
 */
const globalForDb = globalThis as unknown as {
  __noma_sql?: ReturnType<typeof postgres>;
  __noma_db?: PostgresJsDatabase<typeof schema>;
};

function getDb(): PostgresJsDatabase<typeof schema> {
  if (globalForDb.__noma_db) return globalForDb.__noma_db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL no está definido. Copia .env.example a .env.local y complétalo.",
    );
  }

  const sql =
    globalForDb.__noma_sql ?? postgres(connectionString, { prepare: false });
  const instance = drizzle(sql, { schema });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__noma_sql = sql;
    globalForDb.__noma_db = instance;
  }
  return instance;
}

// Proxy que difiere la conexión real al primer acceso a una propiedad.
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    const instance = getDb();
    const value = instance[prop as keyof typeof instance];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
