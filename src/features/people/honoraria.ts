import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { finContacts, finDocuments, ledgerAccounts } from "@/db/schema";
import { toNum } from "@/features/finance/helpers";

export async function getHonorariaBook() {
  const rows = await db
    .select({
      id: finDocuments.id,
      folio: finDocuments.folio,
      emissionDate: finDocuments.fechaEmision,
      total: finDocuments.total,
      net: finDocuments.neto,
      reconciled: finDocuments.montoConciliado,
      status: finDocuments.status,
      contactName: finContacts.name,
      contactRut: finContacts.rut,
      accountName: ledgerAccounts.name,
    })
    .from(finDocuments)
    .leftJoin(finContacts, eq(finDocuments.contactId, finContacts.id))
    .leftJoin(
      ledgerAccounts,
      eq(finDocuments.ledgerAccountId, ledgerAccounts.id),
    )
    .where(
      and(
        eq(finDocuments.direction, "COMPRA"),
        eq(finDocuments.type, "BOLETA_HONORARIOS"),
        eq(finDocuments.recordStatus, "ACTIVO"),
      ),
    )
    .orderBy(desc(finDocuments.fechaEmision));
  return rows.map((row) => {
    const gross = Math.max(toNum(row.net), toNum(row.total));
    const payable = toNum(row.total);
    return {
      ...row,
      gross,
      retention: Math.max(0, gross - payable),
      payable,
      balance: Math.max(0, payable - toNum(row.reconciled)),
    };
  });
}
