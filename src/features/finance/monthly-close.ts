import { and, eq, gte, ilike, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  bankTransactions,
  finDocuments,
  reconciliationTransactions,
  reconciliations,
  salesOrderBillingItems,
  salesOrders,
} from "@/db/schema";
import { monthBounds, toNum } from "./helpers";

export async function getMonthlyCloseCockpit(period: string) {
  const { start, nextStart } = monthBounds(period);
  const [
    transactions,
    automaticRows,
    documents,
    billingItems,
    automaticClassifications,
  ] =
    await Promise.all([
      db
        .select({
          id: bankTransactions.id,
          type: bankTransactions.tipo,
          status: bankTransactions.status,
          amount: bankTransactions.monto,
        })
        .from(bankTransactions)
        .where(
          and(
            eq(bankTransactions.recordStatus, "ACTIVO"),
            gte(bankTransactions.fecha, start),
            lt(bankTransactions.fecha, nextStart),
          ),
        ),
      db
        .select({ transactionId: reconciliationTransactions.bankTransactionId })
        .from(reconciliationTransactions)
        .innerJoin(
          reconciliations,
          eq(
            reconciliationTransactions.reconciliationId,
            reconciliations.id,
          ),
        )
        .innerJoin(
          bankTransactions,
          eq(
            reconciliationTransactions.bankTransactionId,
            bankTransactions.id,
          ),
        )
        .where(
          and(
            eq(reconciliations.status, "ACTIVA"),
            eq(reconciliations.note, "Conciliación automática"),
            gte(bankTransactions.fecha, start),
            lt(bankTransactions.fecha, nextStart),
          ),
        ),
      db
        .select({
          id: finDocuments.id,
          direction: finDocuments.direction,
          status: finDocuments.status,
          total: finDocuments.total,
          reconciled: finDocuments.montoConciliado,
          classified: finDocuments.ledgerAccountId,
        })
        .from(finDocuments)
        .where(
          and(
            eq(finDocuments.recordStatus, "ACTIVO"),
            gte(finDocuments.fechaEmision, start),
            lt(finDocuments.fechaEmision, nextStart),
          ),
        ),
      db
        .select({
          amount: salesOrderBillingItems.calculatedAmount,
          status: salesOrderBillingItems.status,
        })
        .from(salesOrderBillingItems)
        .innerJoin(
          salesOrders,
          eq(salesOrderBillingItems.salesOrderId, salesOrders.id),
        )
        .where(
          and(
            eq(salesOrderBillingItems.status, "PENDIENTE"),
            gte(salesOrderBillingItems.tentativeDate, start),
            lt(salesOrderBillingItems.tentativeDate, nextStart),
          ),
        ),
      db
        .select({ action: activityLog.action })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.entityType, "finance_config"),
            ilike(activityLog.action, "automatic_run:%"),
            gte(activityLog.createdAt, new Date(`${start}T00:00:00Z`)),
            lt(activityLog.createdAt, new Date(`${nextStart}T00:00:00Z`)),
          ),
        ),
    ]);

  const automaticIds = new Set(
    automaticRows.map((row) => row.transactionId),
  );
  const pendingTransactions = transactions.filter(
    (row) => row.status === "PENDIENTE" || row.status === "PARCIAL",
  );
  const reconciledTransactions = transactions.filter(
    (row) => row.status === "CONCILIADO",
  );
  const receivables = documents.filter((row) => row.direction === "VENTA");
  const payables = documents.filter((row) => row.direction === "COMPRA");
  const isPaid = (status: (typeof documents)[number]["status"]) =>
    status === "PAGADA" || status === "CONCILIADA";
  const unclassified = documents.filter((row) => !row.classified);

  const movement = {
    pendingCredits: pendingTransactions.filter((row) => row.type === "ABONO")
      .length,
    pendingDebits: pendingTransactions.filter((row) => row.type === "CARGO")
      .length,
    pendingAmount: pendingTransactions.reduce(
      (sum, row) => sum + toNum(row.amount),
      0,
    ),
    reconciled: reconciledTransactions.length,
    automatic: automaticIds.size,
    total: transactions.length,
  };
  const accountsReceivable = {
    invoices: receivables.filter((row) => !isPaid(row.status)).length,
    salesOrders: billingItems.length,
    amount:
      receivables.reduce(
        (sum, row) =>
          sum + Math.max(0, toNum(row.total) - toNum(row.reconciled)),
        0,
      ) +
      billingItems.reduce((sum, row) => sum + toNum(row.amount), 0),
    completed: receivables.filter((row) => isPaid(row.status)).length,
    total: receivables.length + billingItems.length,
  };
  const accountsPayable = {
    invoices: payables.filter((row) => !isPaid(row.status)).length,
    amount: payables.reduce(
      (sum, row) =>
        sum + Math.max(0, toNum(row.total) - toNum(row.reconciled)),
      0,
    ),
    completed: payables.filter((row) => isPaid(row.status)).length,
    total: payables.length,
  };
  const classification = {
    pending: unclassified.length,
    pendingAmount: unclassified.reduce(
      (sum, row) => sum + toNum(row.total),
      0,
    ),
    classified: documents.length - unclassified.length,
    automatic: automaticClassifications.reduce((sum, row) => {
      const applied = Number(row.action.split(":").at(-1));
      return sum + (Number.isFinite(applied) ? applied : 0);
    }, 0),
    total: documents.length,
  };
  const totalTasks =
    movement.total +
    accountsReceivable.total +
    accountsPayable.total +
    classification.total;
  const completedTasks =
    movement.reconciled +
    accountsReceivable.completed +
    accountsPayable.completed +
    classification.classified;

  return {
    period,
    progress: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 100,
    completedTasks,
    totalTasks,
    movement,
    accountsReceivable,
    accountsPayable,
    classification,
  };
}
