"use server";

import { eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, finContacts, invoices, projects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";

const searchSchema = z.string().trim().min(2).max(100);
const RESULT_LIMIT = 5;

export type SearchEntityResult = {
  type: "client" | "project" | "invoice" | "finance-contact";
  label: string;
  sub?: string;
  href: string;
};

export async function searchEntities(
  query: string,
): Promise<SearchEntityResult[]> {
  const user = await requireUser();
  const parsed = searchSchema.safeParse(query);
  if (!parsed.success) return [];

  const term = `%${parsed.data}%`;
  const isFinance = roleFor(user.email).isFinance;

  const clientQuery = db
    .select({
      id: clients.id,
      name: clients.companyName,
      rut: clients.rut,
    })
    .from(clients)
    .where(or(ilike(clients.companyName, term), ilike(clients.rut, term)))
    .limit(RESULT_LIMIT);

  const projectQuery = db
    .select({
      id: projects.id,
      name: projects.name,
      clientName: clients.companyName,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(ilike(projects.name, term))
    .limit(RESULT_LIMIT);

  const [clientRows, projectRows, invoiceRows, contactRows] = await Promise.all(
    [
      clientQuery,
      projectQuery,
      isFinance
        ? db
            .select({
              id: invoices.id,
              folio: invoices.folio,
              clientName: clients.companyName,
            })
            .from(invoices)
            .innerJoin(clients, eq(clients.id, invoices.clientId))
            .where(ilike(invoices.folio, term))
            .limit(RESULT_LIMIT)
        : Promise.resolve([]),
      isFinance
        ? db
            .select({
              id: finContacts.id,
              name: finContacts.name,
              rut: finContacts.rut,
            })
            .from(finContacts)
            .where(
              or(ilike(finContacts.name, term), ilike(finContacts.rut, term)),
            )
            .limit(RESULT_LIMIT)
        : Promise.resolve([]),
    ],
  );

  return [
    ...clientRows.map((row) => ({
      type: "client" as const,
      label: row.name,
      sub: row.rut ?? undefined,
      href: `/clients/${row.id}`,
    })),
    ...projectRows.map((row) => ({
      type: "project" as const,
      label: row.name,
      sub: row.clientName,
      href: `/projects/${row.id}`,
    })),
    ...invoiceRows.map((row) => ({
      type: "invoice" as const,
      label: `Factura ${row.folio}`,
      sub: row.clientName,
      href: "/finanzas/ingresos",
    })),
    ...contactRows.map((row) => ({
      type: "finance-contact" as const,
      label: row.name,
      sub: row.rut,
      href: "/finanzas/ingresos",
    })),
  ];
}
