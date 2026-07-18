import { asc, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { clients, projects, clientContacts } from "@/db/schema";
import { normalizeRut, isRealRut } from "@/lib/text/rut";

/**
 * Índice RUT normalizado → id de cliente. Lo usa Finanzas para vincular sus
 * contactos tributarios con la ficha comercial en una sola pasada (en vez de
 * una consulta por documento importado).
 *
 * Los RUT comodín se excluyen: los comparten clientes distintos, así que
 * cruzarlos asignaría facturas al cliente equivocado.
 */
export async function getClientRutIndex(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: clients.id, rut: clients.rut })
    .from(clients);
  const index = new Map<string, string>();
  for (const r of rows) {
    if (isRealRut(r.rut)) index.set(normalizeRut(r.rut)!, r.id);
  }
  return index;
}

export async function getClientContacts(clientId: string) {
  return db
    .select()
    .from(clientContacts)
    .where(eq(clientContacts.clientId, clientId))
    .orderBy(desc(clientContacts.isPrimary), asc(clientContacts.name));
}

export async function listClients() {
  return db.select().from(clients).orderBy(asc(clients.companyName));
}

export async function getClient(id: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  return client ?? null;
}

export async function getClientProjects(clientId: string) {
  return db
    .select()
    .from(projects)
    .where(eq(projects.clientId, clientId))
    .orderBy(desc(projects.updatedAt));
}
