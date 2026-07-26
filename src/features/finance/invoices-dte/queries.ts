import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  invoices,
  projects,
  salesOrderBillingItems,
  salesOrders,
} from "@/db/schema";
import type { InvoiceStatus } from "@/types/enums";
import {
  INVOICES_BUCKET,
  signedUrl,
} from "@/lib/supabase/storage";

export async function listInvoiceRegistry(opts?: {
  status?: InvoiceStatus;
  unassigned?: boolean;
}) {
  const filters = [];
  if (opts?.status) filters.push(eq(invoices.status, opts.status));
  if (opts?.unassigned) filters.push(isNull(invoices.salesOrderId));
  return db
    .select({
      invoice: invoices,
      clientName: clients.companyName,
      paymentTermDays: clients.paymentTermDays,
      projectName: projects.name,
      salesOrderFolio: salesOrders.folio,
      billingLabel: salesOrderBillingItems.label,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .leftJoin(salesOrders, eq(invoices.salesOrderId, salesOrders.id))
    .leftJoin(
      salesOrderBillingItems,
      eq(invoices.billingItemId, salesOrderBillingItems.id),
    )
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(invoices.issuedAt), desc(invoices.createdAt));
}

export async function getInvoiceDte(id: string) {
  const [row] = await db
    .select({
      invoice: invoices,
      clientName: clients.companyName,
      paymentTermDays: clients.paymentTermDays,
      projectName: projects.name,
      salesOrderFolio: salesOrders.folio,
      billingLabel: salesOrderBillingItems.label,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .leftJoin(salesOrders, eq(invoices.salesOrderId, salesOrders.id))
    .leftJoin(
      salesOrderBillingItems,
      eq(invoices.billingItemId, salesOrderBillingItems.id),
    )
    .where(eq(invoices.id, id))
    .limit(1);
  if (!row) return null;
  const [pdf, xml] = await Promise.all([
    row.invoice.pdfUrl
      ? signedUrl(INVOICES_BUCKET, row.invoice.pdfUrl)
      : Promise.resolve(null),
    row.invoice.xmlUrl
      ? signedUrl(INVOICES_BUCKET, row.invoice.xmlUrl)
      : Promise.resolve(null),
  ]);
  return { ...row, pdf, xml };
}

export async function listAssignableBillingItems() {
  return db
    .select({
      id: salesOrderBillingItems.id,
      label: salesOrderBillingItems.label,
      amount: salesOrderBillingItems.calculatedAmount,
      salesOrderId: salesOrders.id,
      folio: salesOrders.folio,
      clientName: clients.companyName,
    })
    .from(salesOrderBillingItems)
    .innerJoin(
      salesOrders,
      eq(salesOrderBillingItems.salesOrderId, salesOrders.id),
    )
    .innerJoin(clients, eq(salesOrders.clientId, clients.id))
    .where(
      and(
        eq(salesOrderBillingItems.status, "PENDIENTE"),
        isNull(salesOrderBillingItems.invoiceId),
      ),
    )
    .orderBy(asc(salesOrders.folio), asc(salesOrderBillingItems.order));
}
