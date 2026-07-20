"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { getLatestRates } from "@/lib/currency/rates";
import { IVA_RATE } from "@/features/proposals/totals";
import { getProposal, getProposalServices } from "@/features/proposals/queries";
import { computeTotals, type LineItem } from "@/features/proposals/totals";
import { ensureCollectionSuggestion } from "@/features/automations/rules";
import type { InvoiceStatus } from "@/types/enums";
import { getInvoiceByProposal } from "./queries";

const proposalIdSchema = z.string().uuid("Propuesta inválida.");
const consolidateInvoiceSchema = z.object({
  percent: z.number().min(1).max(100).optional(),
  glosa: z.string().max(1_000).optional(),
  paymentTerms: z.string().max(500).optional(),
  pdfUrl: z.string().url().optional().or(z.literal("")),
  xmlUrl: z.string().url().optional().or(z.literal("")),
});

/** Consolida la factura inicial (por defecto 50%) de una propuesta. Solo Finanzas. */
export async function consolidateInvoice(
  proposalId: string,
  input: {
    percent?: number;
    glosa?: string;
    paymentTerms?: string;
    pdfUrl?: string;
    xmlUrl?: string;
  },
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!roleFor(user.email).isFinance) {
      return { ok: false, error: "Solo el área de Finanzas puede facturar." };
    }
    const parsedProposalId = proposalIdSchema.parse(proposalId);
    const parsedInput = consolidateInvoiceSchema.parse(input);
    const row = await getProposal(parsedProposalId);
    if (!row) return { ok: false, error: "Propuesta no encontrada." };
    if (!row.proposal.clientId) {
      return { ok: false, error: "La propuesta no tiene cliente asociado." };
    }
    const clientId = row.proposal.clientId;

    const [services, rates] = await Promise.all([
      getProposalServices(parsedProposalId),
      getLatestRates(),
    ]);
    const ufClp = Number(rates.ufClp) || 0;
    const items: LineItem[] = services.map((sv) => ({
      amount: Number(sv.customPriceAmount ?? sv.priceAmount) || null,
      currency: (sv.customPriceCurrency ??
        sv.priceCurrency ??
        "UF") as LineItem["currency"],
    }));
    const totals = computeTotals(items, ufClp);

    const percent = parsedInput.percent ?? 50;
    const net = Math.round((totals.netClp * percent) / 100);
    const iva = Math.round(net * IVA_RATE);
    const total = net + iva;

    const data = {
      status: "Preparado para facturar" as InvoiceStatus,
      glosa:
        parsedInput.glosa ??
        `Anticipo ${percent}% · ${row.proposal.title} (${row.projectName})`,
      paymentTerms: parsedInput.paymentTerms ?? null,
      currency: "CLP" as const,
      netAmount: String(net),
      ivaAmount: String(iva),
      totalAmount: String(total),
      balanceDue: String(total),
      pdfUrl: parsedInput.pdfUrl?.trim() || null,
      xmlUrl: parsedInput.xmlUrl?.trim() || null,
      lineItems: services.map((s) => ({
        serviceId: s.serviceId,
        name: s.name,
        amount: Number(s.customPriceAmount ?? s.priceAmount) || 0,
      })),
    };

    const existing = await getInvoiceByProposal(parsedProposalId);
    let invoiceId: string;
    if (existing) {
      await db
        .update(invoices)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(invoices.id, existing.id));
      invoiceId = existing.id;
    } else {
      const [invoice] = await db
        .insert(invoices)
        .values({
          proposalId: parsedProposalId,
          projectId: row.proposal.projectId,
          clientId,
          ...data,
          createdBy: user.id,
        })
        .returning({ id: invoices.id });
      invoiceId = invoice.id;
    }

    await ensureCollectionSuggestion({
      projectId: row.proposal.projectId,
      invoiceId,
      actor: { id: user.id, email: user.email },
    });
    revalidatePath(`/proposals/${parsedProposalId}/sla`);
    revalidatePath("/finanzas/cobranza");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "consolidateInvoice");
  }
}

export async function updateInvoice(
  invoiceId: string,
  proposalId: string,
  patch: {
    nuboxId?: string;
    folio?: string;
    pdfUrl?: string;
    xmlUrl?: string;
    status?: InvoiceStatus;
  },
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!roleFor(user.email).isFinance) {
      return { ok: false, error: "Solo Finanzas puede modificar facturas." };
    }
    await db
      .update(invoices)
      .set({
        nuboxId: patch.nuboxId?.trim() || null,
        folio: patch.folio?.trim() || null,
        pdfUrl: patch.pdfUrl?.trim() || null,
        xmlUrl: patch.xmlUrl?.trim() || null,
        ...(patch.status ? { status: patch.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));
    revalidatePath(`/proposals/${proposalId}/sla`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateInvoice");
  }
}
