"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  bankTransactions,
  finDocuments,
  reconciliations,
  reconciliationDocuments,
  reconciliationTransactions,
} from "@/db/schema";
import { requireFinance } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { FinDocumentStatus, BankTxnStatus } from "@/types/enums";
import { toNum, money } from "./helpers";

function docStatusFor(
  total: number,
  conciliado: number,
  vencimiento: string | null,
): FinDocumentStatus {
  if (conciliado >= total - 0.5) return "CONCILIADA";
  if (conciliado > 0) return "PARCIAL";
  if (vencimiento && new Date(vencimiento) < new Date()) return "VENCIDA";
  return "EMITIDA";
}

function revalidate() {
  revalidatePath("/finanzas/banco");
  revalidatePath("/finanzas/ingresos");
  revalidatePath("/finanzas/egresos");
  revalidatePath("/finanzas");
}

/**
 * Crea una conciliación entre un movimiento bancario y uno o más documentos.
 * Distribuye el monto del movimiento entre los saldos de los documentos.
 */
export async function createReconciliation(formData: FormData): Promise<void> {
  const user = await requireFinance();

  const txnIds = [
    ...formData.getAll("txnIds").map(String),
    ...formData.getAll("txnId").map(String),
  ].filter(Boolean);
  const docIds = formData.getAll("docIds").map(String).filter(Boolean);
  if (txnIds.length === 0 || docIds.length === 0) {
    throw new Error("Falta el movimiento o los documentos.");
  }
  await reconcileMany(txnIds, docIds, user.id, "manual");
  revalidate();
}

export async function reconcileMany(
  txnIds: string[],
  docIds: string[],
  actorId: string,
  source: "manual" | "automatic",
) {
  await db.transaction(async (tx) => {
    const txns = await tx
      .select()
      .from(bankTransactions)
      .where(inArray(bankTransactions.id, txnIds));
    if (txns.length !== txnIds.length) {
      throw new Error("Uno o más movimientos no fueron encontrados.");
    }
    if (new Set(txns.map((txn) => txn.tipo)).size > 1) {
      throw new Error("No se pueden mezclar cargos y abonos.");
    }

    const docs = await tx
      .select()
      .from(finDocuments)
      .where(inArray(finDocuments.id, docIds));

    const [rec] = await tx
      .insert(reconciliations)
      .values({
        status: "ACTIVA",
        note: source === "automatic" ? "Conciliación automática" : null,
        createdById: actorId,
      })
      .returning({ id: reconciliations.id });

    const txnRemaining = new Map(
      txns.map((txn) => [
        txn.id,
        Math.max(0, toNum(txn.monto) - toNum(txn.montoConciliado)),
      ]),
    );
    const txnApplied = new Map<string, number>();
    for (const doc of docs) {
      const saldo = toNum(doc.total) - toNum(doc.montoConciliado);
      const available = [...txnRemaining.values()].reduce(
        (sum, amount) => sum + amount,
        0,
      );
      if (saldo <= 0 || available <= 0) continue;
      const applied = Math.min(saldo, available);
      let toDistribute = applied;
      for (const txn of txns) {
        const remaining = txnRemaining.get(txn.id) ?? 0;
        if (remaining <= 0 || toDistribute <= 0) continue;
        const portion = Math.min(remaining, toDistribute);
        txnRemaining.set(txn.id, remaining - portion);
        txnApplied.set(txn.id, (txnApplied.get(txn.id) ?? 0) + portion);
        toDistribute -= portion;
      }

      await tx.insert(reconciliationDocuments).values({
        reconciliationId: rec.id,
        documentId: doc.id,
        amountApplied: money(applied),
      });

      const nuevoConciliado = toNum(doc.montoConciliado) + applied;
      await tx
        .update(finDocuments)
        .set({
          montoConciliado: money(nuevoConciliado),
          status: docStatusFor(
            toNum(doc.total),
            nuevoConciliado,
            doc.fechaVencimiento,
          ),
        })
        .where(eq(finDocuments.id, doc.id));
    }

    for (const txn of txns) {
      const applied = txnApplied.get(txn.id) ?? 0;
      if (applied <= 0) continue;
      await tx.insert(reconciliationTransactions).values({
        reconciliationId: rec.id,
        bankTransactionId: txn.id,
        amountApplied: money(applied),
      });
      const txnConciliado = toNum(txn.montoConciliado) + applied;
      const txnStatus: BankTxnStatus =
        txnConciliado >= toNum(txn.monto) - 0.5 ? "CONCILIADO" : "PARCIAL";
      await tx
        .update(bankTransactions)
        .set({ montoConciliado: money(txnConciliado), status: txnStatus })
        .where(eq(bankTransactions.id, txn.id));
    }

    const totalDifference = [...txnRemaining.values()].reduce(
      (sum, amount) => sum + amount,
      0,
    );
    await tx
      .update(reconciliations)
      .set({ difference: money(totalDifference) })
      .where(eq(reconciliations.id, rec.id));

    await logActivity({
      entityType: "reconciliation",
      entityId: rec.id,
      action: `reconciliation_created:${source}`,
      actorId,
    }, tx);
  });
}

/** Deshace una conciliación, revirtiendo saldos y estados. */
export async function revertReconciliation(formData: FormData): Promise<void> {
  const user = await requireFinance();
  const reconciliationId = formData.get("reconciliationId") as string;

  await db.transaction(async (tx) => {
    const [rec] = await tx
      .select()
      .from(reconciliations)
      .where(eq(reconciliations.id, reconciliationId))
      .limit(1);
    if (!rec || rec.status === "REVERTIDA") return;

    const docLinks = await tx
      .select()
      .from(reconciliationDocuments)
      .where(eq(reconciliationDocuments.reconciliationId, rec.id));
    const txnLinks = await tx
      .select()
      .from(reconciliationTransactions)
      .where(eq(reconciliationTransactions.reconciliationId, rec.id));

    for (const link of docLinks) {
      const [doc] = await tx
        .select()
        .from(finDocuments)
        .where(eq(finDocuments.id, link.documentId))
        .limit(1);
      if (!doc) continue;
      const nuevo = Math.max(
        0,
        toNum(doc.montoConciliado) - toNum(link.amountApplied),
      );
      await tx
        .update(finDocuments)
        .set({
          montoConciliado: money(nuevo),
          status: docStatusFor(toNum(doc.total), nuevo, doc.fechaVencimiento),
        })
        .where(eq(finDocuments.id, doc.id));
    }

    for (const link of txnLinks) {
      const [txn] = await tx
        .select()
        .from(bankTransactions)
        .where(eq(bankTransactions.id, link.bankTransactionId))
        .limit(1);
      if (!txn) continue;
      const nuevo = Math.max(
        0,
        toNum(txn.montoConciliado) - toNum(link.amountApplied),
      );
      const status: BankTxnStatus = nuevo <= 0.5 ? "PENDIENTE" : "PARCIAL";
      await tx
        .update(bankTransactions)
        .set({ montoConciliado: money(nuevo), status })
        .where(eq(bankTransactions.id, txn.id));
    }

    await tx
      .update(reconciliations)
      .set({
        status: "REVERTIDA",
        revertedAt: new Date(),
        revertedById: user.id,
      })
      .where(eq(reconciliations.id, rec.id));

    await logActivity({
      entityType: "reconciliation",
      entityId: rec.id,
      action: "reconciliation_reverted",
      actorId: user.id,
    });
  });

  revalidate();
}

/** Marca un movimiento como ignorado (no conciliable). */
export async function ignoreTransaction(formData: FormData): Promise<void> {
  const user = await requireFinance();
  const id = formData.get("id") as string;
  await db
    .update(bankTransactions)
    .set({ status: "IGNORADO" })
    .where(eq(bankTransactions.id, id));
  await logActivity({
    entityType: "bank_transaction",
    entityId: id,
    action: "transaction_ignored",
    actorId: user.id,
  });
  revalidatePath("/finanzas/banco");
}
