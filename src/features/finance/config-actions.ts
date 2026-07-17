"use server";

import { revalidatePath } from "next/cache";
import { eq, and, isNull, ne, count } from "drizzle-orm";
import { db } from "@/db";
import {
  bankAccounts,
  bankTransactions,
  classificationRules,
  finDocuments,
  finContacts,
} from "@/db/schema";
import { requireFinance } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type {
  Currency,
  RuleMatchField,
} from "@/types/enums";
import { loadActiveRules, classify } from "./import/classify";
import { toNum } from "./helpers";

function revalidate() {
  revalidatePath("/finanzas/configuracion");
  revalidatePath("/finanzas/banco");
}

// ── Cuentas bancarias ────────────────────────────────────────

export async function createBankAccount(formData: FormData): Promise<void> {
  const user = await requireFinance();
  const bank = ((formData.get("bank") as string) || "").trim();
  const name = ((formData.get("name") as string) || "").trim();
  const number = ((formData.get("number") as string) || "").trim() || null;
  const currency = ((formData.get("currency") as string) || "CLP") as Currency;
  if (!bank || !name) throw new Error("Banco y nombre son obligatorios.");

  const [row] = await db
    .insert(bankAccounts)
    .values({ bank, name, number, currency })
    .returning({ id: bankAccounts.id });
  await logActivity({
    entityType: "bank_account",
    entityId: row.id,
    action: "bank_account_created",
    actorId: user.id,
  });
  revalidate();
}

export async function deleteBankAccount(formData: FormData): Promise<void> {
  const user = await requireFinance();
  const id = formData.get("id") as string;
  // No borrar si tiene movimientos (evita perder cartola por cascade).
  const [{ value: txns }] = await db
    .select({ value: count() })
    .from(bankTransactions)
    .where(eq(bankTransactions.bankAccountId, id));
  if (txns > 0) {
    throw new Error("No se puede eliminar: la cuenta tiene movimientos.");
  }
  await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
  await logActivity({
    entityType: "bank_account",
    entityId: id,
    action: "bank_account_deleted",
    actorId: user.id,
  });
  revalidate();
}

// ── Reglas de clasificación ──────────────────────────────────

export async function createClassificationRule(
  formData: FormData,
): Promise<void> {
  const user = await requireFinance();
  const name = ((formData.get("name") as string) || "").trim();
  const matchField = (formData.get("matchField") as string) as RuleMatchField;
  const matchOperator = (formData.get("matchOperator") as string) || "equals";
  const matchValue = ((formData.get("matchValue") as string) || "").trim();
  const ledgerAccountId = (formData.get("ledgerAccountId") as string) || null;
  const costCenterId = (formData.get("costCenterId") as string) || null;
  const businessLineId = (formData.get("businessLineId") as string) || null;
  const priority = Number(formData.get("priority")) || 100;

  if (!name || !matchField || !matchValue) {
    throw new Error("Nombre, campo y valor son obligatorios.");
  }
  if (!ledgerAccountId && !costCenterId && !businessLineId) {
    throw new Error("La regla debe asignar al menos una dimensión.");
  }

  const [row] = await db
    .insert(classificationRules)
    .values({
      name,
      matchField,
      matchOperator,
      matchValue,
      ledgerAccountId,
      costCenterId,
      businessLineId,
      priority,
    })
    .returning({ id: classificationRules.id });
  await logActivity({
    entityType: "classification_rule",
    entityId: row.id,
    action: "rule_created",
    actorId: user.id,
  });
  revalidate();
}

export async function toggleClassificationRule(
  formData: FormData,
): Promise<void> {
  await requireFinance();
  const id = formData.get("id") as string;
  const isActive = formData.get("isActive") === "true";
  await db
    .update(classificationRules)
    .set({ isActive: !isActive })
    .where(eq(classificationRules.id, id));
  revalidate();
}

export async function deleteClassificationRule(
  formData: FormData,
): Promise<void> {
  const user = await requireFinance();
  const id = formData.get("id") as string;
  await db.delete(classificationRules).where(eq(classificationRules.id, id));
  await logActivity({
    entityType: "classification_rule",
    entityId: id,
    action: "rule_deleted",
    actorId: user.id,
  });
  revalidate();
}

/**
 * Aplica las reglas activas a los documentos aún sin clasificar.
 * Útil tras crear reglas nuevas: clasifica en lote lo ya importado.
 */
export async function applyRulesToUnclassified(): Promise<void> {
  const user = await requireFinance();
  const rules = await loadActiveRules();
  if (rules.length === 0) return;

  const docs = await db
    .select({
      id: finDocuments.id,
      total: finDocuments.total,
      rut: finContacts.rut,
      nombre: finContacts.name,
    })
    .from(finDocuments)
    .leftJoin(finContacts, eq(finDocuments.contactId, finContacts.id))
    .where(
      and(
        isNull(finDocuments.ledgerAccountId),
        eq(finDocuments.recordStatus, "ACTIVO"),
        ne(finDocuments.status, "ANULADA"),
      ),
    );

  for (const d of docs) {
    const cls = classify(rules, {
      rut: d.rut ?? "",
      nombre: d.nombre ?? "",
      total: toNum(d.total),
    });
    if (cls.ledgerAccountId || cls.costCenterId || cls.businessLineId) {
      await db
        .update(finDocuments)
        .set({
          ledgerAccountId: cls.ledgerAccountId,
          costCenterId: cls.costCenterId,
          businessLineId: cls.businessLineId,
        })
        .where(eq(finDocuments.id, d.id));
    }
  }

  await logActivity({
    entityType: "classification_rule",
    action: "rules_applied_bulk",
    actorId: user.id,
  });
  revalidatePath("/finanzas/plan-cuentas/sin-clasificar");
  revalidatePath("/finanzas/reportes");
  revalidate();
}
