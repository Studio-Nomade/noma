"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  clients,
  invoices,
  salesOrderBillingItems,
  salesOrders,
} from "@/db/schema";
import { requireFinance } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import {
  INVOICES_BUCKET,
  uploadToStorage,
} from "@/lib/supabase/storage";

const idSchema = z.string().uuid();

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function refreshSalesOrderStatus(
  salesOrderId: string,
  writer: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  const items = await writer
    .select({ status: salesOrderBillingItems.status })
    .from(salesOrderBillingItems)
    .where(eq(salesOrderBillingItems.salesOrderId, salesOrderId));
  const billed = items.filter((item) => item.status !== "PENDIENTE").length;
  await writer
    .update(salesOrders)
    .set({
      status:
        billed === items.length ? "FACTURADA" : "FACTURADA_PARCIAL",
      updatedAt: new Date(),
    })
    .where(eq(salesOrders.id, salesOrderId));
}

export async function createInvoiceForBillingItem(
  salesOrderId: string,
  billingItemId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireFinance();
    const orderId = idSchema.parse(salesOrderId);
    const itemId = idSchema.parse(billingItemId);
    const [row] = await db
      .select({
        order: salesOrders,
        item: salesOrderBillingItems,
        paymentTermDays: clients.paymentTermDays,
      })
      .from(salesOrderBillingItems)
      .innerJoin(
        salesOrders,
        eq(salesOrderBillingItems.salesOrderId, salesOrders.id),
      )
      .innerJoin(clients, eq(salesOrders.clientId, clients.id))
      .where(
        and(
          eq(salesOrders.id, orderId),
          eq(salesOrderBillingItems.id, itemId),
        ),
      )
      .limit(1);
    if (!row) return { ok: false, error: "Hito de facturación no encontrado." };
    if (row.item.invoiceId || row.item.status !== "PENDIENTE") {
      return { ok: false, error: "Este hito ya fue facturado." };
    }
    const total = Math.round(Number(row.item.calculatedAmount));
    const net = Math.round(total / 1.19);
    const iva = total - net;
    const issued = new Date();
    const due = new Date(issued);
    due.setDate(due.getDate() + row.paymentTermDays);

    const created = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(invoices)
        .values({
          clientId: row.order.clientId,
          projectId: row.order.projectId,
          proposalId: row.order.proposalId,
          salesOrderId: row.order.id,
          billingItemId: row.item.id,
          status: "Por cobrar",
          glosa: `${row.order.folio} · ${row.item.label}`,
          paymentTerms: `${row.paymentTermDays} días`,
          currency: "CLP",
          netAmount: String(net),
          ivaAmount: String(iva),
          totalAmount: String(total),
          balanceDue: String(total),
          lineItems: [{ name: row.item.label, amount: total }],
          issuedAt: iso(issued),
          dueAt: iso(due),
          estimatedPaymentDate: iso(due),
          createdBy: user.id,
        })
        .returning({ id: invoices.id });
      await tx
        .update(salesOrderBillingItems)
        .set({
          status: "FACTURADO",
          invoiceId: invoice.id,
          updatedAt: new Date(),
        })
        .where(eq(salesOrderBillingItems.id, itemId));
      await refreshSalesOrderStatus(orderId, tx);
      await logActivity(
        {
          entityType: "invoice",
          entityId: invoice.id,
          action: `created_from_sales_order:${row.order.folio}`,
          actorId: user.id,
        },
        tx,
      );
      return invoice;
    });
    revalidateFinance(row.order.id);
    return { ok: true, data: created };
  } catch (error) {
    return handleActionError(error, "createInvoiceForBillingItem");
  }
}

export async function assignInvoiceToBillingItem(
  formData: FormData,
): Promise<void> {
  const user = await requireFinance();
  const invoiceId = idSchema.parse(formData.get("invoiceId"));
  const billingItemId = idSchema.parse(formData.get("billingItemId"));
  const [item] = await db
    .select({
      item: salesOrderBillingItems,
      salesOrderId: salesOrders.id,
      projectId: salesOrders.projectId,
      proposalId: salesOrders.proposalId,
    })
    .from(salesOrderBillingItems)
    .innerJoin(
      salesOrders,
      eq(salesOrderBillingItems.salesOrderId, salesOrders.id),
    )
    .where(eq(salesOrderBillingItems.id, billingItemId))
    .limit(1);
  if (!item || item.item.invoiceId) return;
  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({
        salesOrderId: item.salesOrderId,
        billingItemId,
        projectId: item.projectId,
        proposalId: item.proposalId,
        status: "Por cobrar",
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));
    await tx
      .update(salesOrderBillingItems)
      .set({ invoiceId, status: "FACTURADO", updatedAt: new Date() })
      .where(eq(salesOrderBillingItems.id, billingItemId));
    await refreshSalesOrderStatus(item.salesOrderId, tx);
    await logActivity(
      {
        entityType: "invoice",
        entityId: invoiceId,
        action: `assigned_to_sales_order:${item.salesOrderId}`,
        actorId: user.id,
      },
      tx,
    );
  });
  revalidateFinance(item.salesOrderId);
}

function xmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([^<]+)<`, "i"));
  return match?.[1]?.trim() ?? null;
}

function validDteValues(xml: string) {
  const folio = xmlValue(xml, "Folio");
  const netAmount = xmlValue(xml, "MntNeto");
  const ivaAmount = xmlValue(xml, "IVA");
  const totalAmount = xmlValue(xml, "MntTotal");
  // MntExe (monto exento) es OPCIONAL: documentos afectos puros no lo traen.
  // Cuando existe, entra en la ecuación neto + iva + exento = total.
  const exeAmount = xmlValue(xml, "MntExe");
  const rawAmounts = [netAmount, ivaAmount, totalAmount];
  const net = Number(netAmount);
  const iva = Number(ivaAmount);
  const total = Number(totalAmount);
  const exe = exeAmount && exeAmount !== "" ? Number(exeAmount) : 0;
  const validAmounts =
    rawAmounts.every((value) => value !== null && value !== "") &&
    [net, iva, total, exe].every(
      (value) => Number.isFinite(value) && value >= 0,
    );
  if (!folio || !validAmounts || Math.abs(net + iva + exe - total) > 1) {
    return null;
  }
  return {
    folio,
    netAmount: netAmount!,
    ivaAmount: ivaAmount!,
    totalAmount: totalAmount!,
  };
}

export async function attachInvoiceDte(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireFinance();
    const invoiceId = idSchema.parse(formData.get("invoiceId"));
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) return { ok: false, error: "Adjunta un PDF o XML." };
    if (files.some((file) => file.size > 15 * 1024 * 1024)) {
      return { ok: false, error: "Cada archivo puede pesar hasta 15 MB." };
    }
    const parsedFiles = await Promise.all(
      files.map(async (file) => {
        const lower = file.name.toLowerCase();
        const kind = lower.endsWith(".pdf")
          ? ("pdf" as const)
          : lower.endsWith(".xml")
            ? ("xml" as const)
            : null;
        return {
          file,
          kind,
          buffer: Buffer.from(await file.arrayBuffer()),
        };
      }),
    );
    const invalidXml = parsedFiles.some(
      ({ kind, buffer }) =>
        kind === "xml" && !validDteValues(buffer.toString("utf8")),
    );
    const patch: Partial<typeof invoices.$inferInsert> = {};
    for (const { kind, buffer } of parsedFiles) {
      if (!kind) continue;
      if (kind === "xml" && invalidXml) continue;
      const path = `dte/${invoiceId}/${kind}-${Date.now()}.${kind}`;
      await uploadToStorage(
        INVOICES_BUCKET,
        path,
        buffer,
        kind === "pdf" ? "application/pdf" : "application/xml",
      );
      if (kind === "pdf") patch.pdfUrl = path;
      else {
        const xml = buffer.toString("utf8");
        const dte = validDteValues(xml)!;
        patch.xmlUrl = path;
        patch.folio = dte.folio;
        patch.netAmount = dte.netAmount;
        patch.ivaAmount = dte.ivaAmount;
        patch.totalAmount = dte.totalAmount;
        patch.balanceDue = patch.totalAmount;
        patch.issuedAt = xmlValue(xml, "FchEmis") ?? undefined;
        patch.dueAt = xmlValue(xml, "FchVenc") ?? undefined;
        patch.estimatedPaymentDate = patch.dueAt;
      }
    }
    if (Object.keys(patch).length > 0) {
      await db
        .update(invoices)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(invoices.id, invoiceId));
      await logActivity({
        entityType: "invoice",
        entityId: invoiceId,
        action: "dte_files_attached",
        actorId: user.id,
      });
    }
    revalidatePath(`/finanzas/ingresos/${invoiceId}`);
    revalidatePath("/finanzas/ingresos");
    if (invalidXml) {
      return {
        ok: false,
        error: "El XML del DTE es inválido o inconsistente (folio/montos).",
      };
    }
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "attachInvoiceDte");
  }
}

function revalidateFinance(salesOrderId: string) {
  revalidatePath(`/finanzas/notas-de-venta/${salesOrderId}`);
  revalidatePath("/finanzas/notas-de-venta");
  revalidatePath("/finanzas/ingresos");
}

export async function updateInvoiceCollectionStatus(
  formData: FormData,
): Promise<void> {
  const user = await requireFinance();
  const invoiceId = idSchema.parse(formData.get("invoiceId"));
  const status = z.enum(["Por cobrar", "Pagada", "Reclamada"]).parse(
    formData.get("status"),
  );
  const [invoice] = await db
    .select({
      billingItemId: invoices.billingItemId,
      salesOrderId: invoices.salesOrderId,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!invoice) return;
  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({
        status,
        balanceDue: status === "Pagada" ? "0" : undefined,
        paidAt: status === "Pagada" ? iso(new Date()) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));
    if (invoice.billingItemId) {
      await tx
        .update(salesOrderBillingItems)
        .set({
          status: status === "Pagada" ? "PAGADO" : "FACTURADO",
          updatedAt: new Date(),
        })
        .where(eq(salesOrderBillingItems.id, invoice.billingItemId));
    }
    await logActivity(
      {
        entityType: "invoice",
        entityId: invoiceId,
        action: `collection_status:${status}`,
        actorId: user.id,
      },
      tx,
    );
  });
  revalidatePath(`/finanzas/ingresos/${invoiceId}`);
  revalidatePath("/finanzas/ingresos");
  if (invoice.salesOrderId) {
    revalidatePath(`/finanzas/notas-de-venta/${invoice.salesOrderId}`);
  }
}
