"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  salesOrderBillingItems,
  salesOrderLines,
  salesOrders,
} from "@/db/schema";
import { requireFinance } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { getLatestRates } from "@/lib/currency/rates";
import { getProposal, getProposalServices } from "@/features/proposals/queries";
import {
  computeTotals,
  lineAmount,
  type LineItem,
} from "@/features/proposals/totals";
import { sendGmail } from "@/features/email/gmail";
import {
  appendTextSignature,
  resolveEmailSender,
} from "@/features/email/signatures";
import {
  BILLING_ITEM_STATUSES,
  BILLING_ITEM_TYPES,
  type Currency,
} from "@/types/enums";
import { getSalesOrderByProposal } from "./queries";
import { buildSalesOrderPdfData } from "./build-pdf-data";
import { renderSalesOrderPdf } from "./sales-order-pdf";

const idSchema = z.string().uuid("Identificador inválido.");
const billingItemSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(160),
  type: z.enum(BILLING_ITEM_TYPES),
  value: z.coerce.number().positive(),
  tentativeDate: z.string().date().nullable().optional(),
  deliverable: z.string().trim().max(500).nullable().optional(),
  status: z.enum(BILLING_ITEM_STATUSES).default("PENDIENTE"),
});
const billingPlanSchema = z.array(billingItemSchema).min(1).max(36);
const sendSchema = z.object({
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).max(20).default([]),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
});

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function createSalesOrderFromProposal(
  proposalId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireFinance();
    const parsedId = idSchema.parse(proposalId);
    const existing = await getSalesOrderByProposal(parsedId);
    if (existing) return { ok: true, data: existing };

    const [row, services, rates] = await Promise.all([
      getProposal(parsedId),
      getProposalServices(parsedId),
      getLatestRates(),
    ]);
    if (!row) return { ok: false, error: "Propuesta no encontrada." };
    if (row.proposal.status !== "Aprobada") {
      return {
        ok: false,
        error: "La nota de venta requiere una propuesta aprobada.",
      };
    }
    if (!row.proposal.clientId) {
      return { ok: false, error: "La propuesta no tiene cliente asociado." };
    }
    if (services.length === 0) {
      return { ok: false, error: "La propuesta no contiene servicios." };
    }

    const ufClp = Number(rates.ufClp) || 0;
    const items: LineItem[] = services.map((service) => ({
      amount:
        Number(service.customPriceAmount ?? service.priceAmount) || null,
      currency: (service.customPriceCurrency ??
        service.priceCurrency ??
        "UF") as Currency,
      quantity: service.quantity,
      priority: service.priority,
    }));
    const totals = computeTotals(items, ufClp, {
      label: row.proposal.discountLabel,
      kind: row.proposal.discountKind,
      value:
        row.proposal.discountValue != null
          ? Number(row.proposal.discountValue)
          : null,
    });

    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + 30);
    const created = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('sales_orders_folio'))`,
      );
      const [counter] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(salesOrders);
      const folio = `NV-${today.getFullYear()}-${String((counter?.count ?? 0) + 1).padStart(4, "0")}`;
      const [order] = await tx
        .insert(salesOrders)
        .values({
          folio,
          clientId: row.proposal.clientId!,
          projectId: row.proposal.projectId,
          proposalId: parsedId,
          emissionDate: isoDate(today),
          dueDate: isoDate(due),
          subtotalAmount: String(totals.netAfterDiscount),
          ivaAmount: String(totals.iva),
          totalAmount: String(totals.totalClp),
          currency: "CLP",
          notes: row.proposal.commercialConditions,
          createdBy: user.id,
        })
        .returning({ id: salesOrders.id });

      await tx.insert(salesOrderLines).values(
        services.map((service, position) => {
          const basePrice =
            Number(service.customPriceAmount ?? service.priceAmount) || 0;
          const price = lineAmount({
            amount: basePrice,
            currency: (service.customPriceCurrency ??
              service.priceCurrency ??
              "UF") as Currency,
            quantity: 1,
            priority: service.priority,
          });
          return {
            salesOrderId: order.id,
            position,
            businessLine: service.area,
            serviceId: service.serviceId,
            description: service.name,
            quantity: service.quantity,
            priceAmount: String(price),
            currency: (service.customPriceCurrency ??
              service.priceCurrency ??
              "UF") as Currency,
            discountAmount: "0",
            totalAmount: String(price * service.quantity),
            createdBy: user.id,
          };
        }),
      );
      const half = Math.round(totals.totalClp / 2);
      await tx.insert(salesOrderBillingItems).values([
        {
          salesOrderId: order.id,
          order: 0,
          label: "50% inicial",
          type: "PORCENTAJE",
          value: "50",
          calculatedAmount: String(half),
          tentativeDate: isoDate(today),
          createdBy: user.id,
        },
        {
          salesOrderId: order.id,
          order: 1,
          label: "50% contra entrega",
          type: "PORCENTAJE",
          value: "50",
          calculatedAmount: String(totals.totalClp - half),
          tentativeDate: isoDate(due),
          createdBy: user.id,
        },
      ]);
      await logActivity(
        {
          entityType: "sales_order",
          entityId: order.id,
          action: `created:${folio}`,
          actorId: user.id,
        },
        tx,
      );
      return order;
    });
    revalidatePath(`/proposals/${parsedId}`);
    revalidatePath(`/projects/${row.proposal.projectId}`);
    revalidatePath("/finanzas/notas-de-venta");
    return { ok: true, data: created };
  } catch (error) {
    return handleActionError(error, "createSalesOrderFromProposal");
  }
}

export async function createSalesOrderAndOpen(proposalId: string) {
  const result = await createSalesOrderFromProposal(proposalId);
  if (result.ok) redirect(`/finanzas/notas-de-venta/${result.data.id}`);
  redirect(`/proposals/${proposalId}?salesOrderError=1`);
}

export async function saveBillingPlan(
  salesOrderId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireFinance();
    const id = idSchema.parse(salesOrderId);
    const items = billingPlanSchema.parse(input);
    const [order] = await db
      .select({ total: salesOrders.totalAmount })
      .from(salesOrders)
      .where(eq(salesOrders.id, id))
      .limit(1);
    if (!order) return { ok: false, error: "Nota de venta no encontrada." };

    const total = Number(order.total);
    const prepared = items.map((item) => ({
      ...item,
      calculatedAmount:
        item.type === "PORCENTAJE"
          ? Math.round((total * item.value) / 100)
          : Math.round(item.value),
    }));
    const sum = prepared.reduce(
      (acc, item) => acc + item.calculatedAmount,
      0,
    );
    if (Math.abs(sum - total) > 1) {
      return {
        ok: false,
        error: `El esquema debe sumar el total de la nota (${total.toLocaleString("es-CL")} CLP).`,
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(salesOrderBillingItems)
        .where(
          and(
            eq(salesOrderBillingItems.salesOrderId, id),
            ne(salesOrderBillingItems.status, "FACTURADO"),
            ne(salesOrderBillingItems.status, "PAGADO"),
          ),
        );
      const editable = prepared.filter(
        (item) => item.status === "PENDIENTE" || !item.id,
      );
      if (editable.length) {
        await tx.insert(salesOrderBillingItems).values(
          editable.map((item, index) => ({
            salesOrderId: id,
            order: index,
            label: item.label,
            type: item.type,
            value: String(item.value),
            calculatedAmount: String(item.calculatedAmount),
            tentativeDate: item.tentativeDate ?? null,
            deliverable: item.deliverable || null,
            status: item.status,
            createdBy: user.id,
          })),
        );
      }
      await logActivity(
        {
          entityType: "sales_order",
          entityId: id,
          action: "billing_plan_updated",
          actorId: user.id,
        },
        tx,
      );
    });
    revalidatePath(`/finanzas/notas-de-venta/${id}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "saveBillingPlan");
  }
}

export async function sendSalesOrder(
  salesOrderId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireFinance();
    const id = idSchema.parse(salesOrderId);
    const message = sendSchema.parse(input);
    const bundle = await buildSalesOrderPdfData(id);
    if (!bundle) return { ok: false, error: "Nota de venta no encontrada." };
    const sender = await resolveEmailSender("commercial");
    if (!sender.ok) return { ok: false, error: sender.reason };
    const pdf = await renderSalesOrderPdf(bundle.data);
    await sendGmail({
      userId: sender.userId,
      from: sender.from,
      fromName: sender.fromName,
      to: message.to,
      cc: message.cc,
      subject: message.subject,
      body: appendTextSignature(message.body, sender.signatureText),
      attachment: { filename: bundle.filename, content: pdf },
    });
    await db.update(salesOrders).set({
      status: "ENVIADA",
      sentAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(salesOrders.id, id));
    await logActivity({
      entityType: "sales_order",
      entityId: id,
      action: `sent:${message.to.join(",")}`,
      actorId: user.id,
    });
    revalidatePath(`/finanzas/notas-de-venta/${id}`);
    revalidatePath("/finanzas/notas-de-venta");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "sendSalesOrder");
  }
}
