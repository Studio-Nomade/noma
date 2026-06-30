"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { slas } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { formatMoney } from "@/lib/currency/format";
import { getLatestRates } from "@/lib/currency/rates";
import { AREA_THEME } from "@/lib/brand/brand";
import type { SlaStatus } from "@/types/enums";
import { getProposal, getProposalServices } from "@/features/proposals/queries";
import { getClient } from "@/features/clients/queries";
import { computeTotals, type LineItem } from "@/features/proposals/totals";
import { buildSlaSections, type SlaParams } from "./generate";
import { getSlaByProposal } from "./queries";

/** Genera (o regenera) el SLA de una propuesta a partir de sus datos + params. */
export async function generateSla(
  proposalId: string,
  params?: SlaParams,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const row = await getProposal(proposalId);
    if (!row) return { ok: false, error: "Propuesta no encontrada." };
    const { proposal, clientName, projectName, projectArea, projectAreas } =
      row;

    const [services, rates, client] = await Promise.all([
      getProposalServices(proposalId),
      getLatestRates(),
      proposal.clientId ? getClient(proposal.clientId) : Promise.resolve(null),
    ]);

    const ufClp = Number(rates.ufClp) || 0;
    const items: LineItem[] = services.map((sv) => ({
      amount: Number(sv.customPriceAmount ?? sv.priceAmount) || null,
      currency: (sv.customPriceCurrency ??
        sv.priceCurrency ??
        "UF") as LineItem["currency"],
    }));
    const totals = computeTotals(items, ufClp);
    const areas = projectAreas?.length ? projectAreas : [projectArea];
    const areasLabel = areas.map((a) => AREA_THEME[a].label).join(" + ");

    const existing = await getSlaByProposal(proposalId);
    const mergedParams: SlaParams = {
      ...(existing?.params ?? {}),
      ...(params ?? {}),
    };

    const sections = buildSlaSections({
      clientName: clientName ?? "Cliente",
      legalName: client?.legalName,
      rut: client?.rut,
      projectName,
      areasLabel,
      services: services.map((s) => ({ name: s.name, area: s.area })),
      totalLabel: formatMoney(totals.totalClp, "CLP"),
      params: mergedParams,
    });

    if (existing) {
      await db
        .update(slas)
        .set({ sections, params: mergedParams, updatedAt: new Date() })
        .where(eq(slas.id, existing.id));
      revalidatePath(`/proposals/${proposalId}/sla`);
      return { ok: true, data: { id: existing.id } };
    }

    const [created] = await db
      .insert(slas)
      .values({
        proposalId,
        projectId: proposal.projectId,
        clientId: proposal.clientId,
        params: mergedParams,
        sections,
        createdBy: user.id,
      })
      .returning({ id: slas.id });
    revalidatePath(`/proposals/${proposalId}/sla`);
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return handleActionError(err, "generateSla");
  }
}

export async function updateSlaSection(
  slaId: string,
  proposalId: string,
  index: number,
  body: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    const [row] = await db
      .select()
      .from(slas)
      .where(eq(slas.id, slaId))
      .limit(1);
    if (!row) return { ok: false, error: "SLA no encontrado." };
    const sections = [...(row.sections ?? [])];
    if (sections[index]) sections[index] = { ...sections[index], body };
    await db
      .update(slas)
      .set({ sections, updatedAt: new Date() })
      .where(eq(slas.id, slaId));
    revalidatePath(`/proposals/${proposalId}/sla`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateSlaSection");
  }
}

export async function setSlaStatus(
  slaId: string,
  proposalId: string,
  status: SlaStatus,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db
      .update(slas)
      .set({ status, updatedAt: new Date() })
      .where(eq(slas.id, slaId));
    revalidatePath(`/proposals/${proposalId}/sla`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "setSlaStatus");
  }
}

/** Firma electrónica del representante legal (ej. Anna). */
export async function signSla(
  slaId: string,
  proposalId: string,
  name: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    if (!name.trim())
      return { ok: false, error: "Indica el nombre del firmante." };
    await db
      .update(slas)
      .set({
        signedByName: name.trim(),
        signedAt: new Date(),
        status: "Firmado",
        updatedAt: new Date(),
      })
      .where(eq(slas.id, slaId));
    revalidatePath(`/proposals/${proposalId}/sla`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "signSla");
  }
}
