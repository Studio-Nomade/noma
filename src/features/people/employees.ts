import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees } from "@/db/schema";

export async function listEmployees() {
  return db.select().from(employees).orderBy(asc(employees.name));
}

export async function getActiveEmployeeCount() {
  const rows = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.status, "ACTIVO"));
  return rows.length;
}
