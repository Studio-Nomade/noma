"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { finDocuments } from "@/db/schema";
import { requireFinance } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

function revalidate() {
  revalidatePath("/finanzas/ingresos");
  revalidatePath("/finanzas/egresos");
  revalidatePath("/finanzas/plan-cuentas/sin-clasificar");
  revalidatePath("/finanzas/reportes");
  revalidatePath("/finanzas");
}

/** Marca un documento como pagado (conciliado manualmente sin banco). */
export async function markDocumentPaid(formData: FormData): Promise<void> {
  const user = await requireFinance();
  const id = formData.get("id") as string;

  const [doc] = await db
    .select()
    .from(finDocuments)
    .where(eq(finDocuments.id, id))
    .limit(1);
  if (!doc) return;

  await db
    .update(finDocuments)
    .set({ status: "PAGADA", montoConciliado: doc.total })
    .where(eq(finDocuments.id, id));
  await logActivity({
    entityType: "fin_document",
    entityId: id,
    action: "document_marked_paid",
    actorId: user.id,
  });
  revalidate();
}

/** Anula un documento (eliminación lógica, conserva trazabilidad). */
export async function anularDocument(formData: FormData): Promise<void> {
  const user = await requireFinance();
  const id = formData.get("id") as string;

  const [doc] = await db
    .select()
    .from(finDocuments)
    .where(eq(finDocuments.id, id))
    .limit(1);
  if (!doc) return;

  await db
    .update(finDocuments)
    .set({ status: "ANULADA", recordStatus: "ANULADO" })
    .where(eq(finDocuments.id, id));
  await logActivity({
    entityType: "fin_document",
    entityId: id,
    action: "document_anulado",
    actorId: user.id,
  });
  revalidate();
}

/** Clasifica un documento (cuenta contable / centro de costo / línea). */
export async function classifyDocument(formData: FormData): Promise<void> {
  const user = await requireFinance();
  const id = formData.get("id") as string;
  const ledgerAccountId = (formData.get("ledgerAccountId") as string) || null;
  const costCenterId = (formData.get("costCenterId") as string) || null;
  const businessLineId = (formData.get("businessLineId") as string) || null;

  await db
    .update(finDocuments)
    .set({ ledgerAccountId, costCenterId, businessLineId })
    .where(eq(finDocuments.id, id));
  await logActivity({
    entityType: "fin_document",
    entityId: id,
    action: "document_classified",
    actorId: user.id,
  });
  revalidate();
}
