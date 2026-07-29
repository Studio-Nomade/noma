"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { paymentReports } from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { getPortalData } from "./portal-queries";

const paymentReportSchema = z.object({
  token: z.string().min(32).max(128),
  kind: z.enum(["invoice", "sales-order"]),
  entityId: z.string().uuid(),
  amount: z.coerce.number().positive().max(999_999_999_999),
  paidAt: z.string().date(),
  reference: z.string().trim().max(160).optional(),
});

/**
 * Registra un pago informado. No cambia saldos ni estados contables: Finanzas
 * debe validarlo y conciliarlo. Esta frontera puede reemplazarse más adelante
 * por un proveedor de pagos sin cambiar el contrato del portal.
 */
export async function reportPortalPayment(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const input = paymentReportSchema.parse(Object.fromEntries(formData));
    const portal = await getPortalData(input.token);
    if (!portal) return { ok: false, error: "Enlace inválido o revocado." };

    const isInvoice =
      input.kind === "invoice" &&
      portal.account.invoices.some((invoice) => invoice.id === input.entityId);
    const isSalesOrder =
      input.kind === "sales-order" &&
      portal.salesOrders.some((order) => order.id === input.entityId);
    if (!isInvoice && !isSalesOrder) {
      return { ok: false, error: "Documento no disponible." };
    }

    const existing = await db
      .select({ id: paymentReports.id })
      .from(paymentReports)
      .where(
        and(
          eq(paymentReports.clientId, portal.clientId),
          input.kind === "invoice"
            ? eq(paymentReports.documentId, input.entityId)
            : eq(paymentReports.salesOrderId, input.entityId),
          eq(paymentReports.status, "PENDIENTE"),
        ),
      )
      .limit(1);
    if (existing.length) {
      return { ok: true, data: undefined };
    }

    const [report] = await db
      .insert(paymentReports)
      .values({
        clientId: portal.clientId,
        documentId: isInvoice ? input.entityId : null,
        salesOrderId: isSalesOrder ? input.entityId : null,
        amount: input.amount.toFixed(2),
        paidAt: input.paidAt,
        reference: input.reference || null,
      })
      .returning({ id: paymentReports.id });
    await logActivity({
      entityType: "payment_report",
      entityId: report.id,
      action: `portal_payment_reported:${input.kind}`,
    });
    revalidatePath(`/portal/${input.token}`);
    revalidatePath("/finanzas/cobranza");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "reportPortalPayment");
  }
}
