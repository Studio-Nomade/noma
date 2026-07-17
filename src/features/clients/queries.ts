import { asc, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { clients, projects, clientContacts } from "@/db/schema";

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
