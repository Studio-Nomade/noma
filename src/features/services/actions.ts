"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceVariants, services } from "@/db/schema";
import { requireCatalogEditor } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { ensureServiceLedgerAccount } from "@/features/finance/plan-accounts/service-link";
import { serviceSchema, type ServiceFormValues } from "./schema";
import type { ServiceStatus } from "@/types/enums";

function normalize(values: ServiceFormValues) {
  const d = serviceSchema.parse(values);
  const emptyToNull = (v?: string) => (v && v.trim() !== "" ? v : null);
  const variants = d.variants.map((variant) => ({
    ...variant,
    audience: emptyToNull(variant.audience),
    focus: emptyToNull(variant.focus),
    description: emptyToNull(variant.description),
    methodology: emptyToNull(variant.methodology),
    deliverables: emptyToNull(variant.deliverables),
    exclusions: emptyToNull(variant.exclusions),
    estimatedTime: emptyToNull(variant.estimatedTime),
    priceMinAmount: emptyToNull(variant.priceMinAmount),
    priceMaxAmount: emptyToNull(variant.priceMaxAmount),
  }));
  const start = variants.find((variant) => variant.tier === "START")!;
  return {
    service: {
      name: d.name,
      area: d.area,
      subarea: emptyToNull(d.subarea),
      description: start.description,
      methodology: start.methodology,
      deliverables: start.deliverables,
      exclusions: start.exclusions,
      estimatedTime: start.estimatedTime,
      priceMinAmount: start.priceMinAmount,
      priceMaxAmount: start.priceMaxAmount,
      priceCurrency: start.priceCurrency,
      requirements: emptyToNull(d.requirements),
      status: d.status,
    },
    variants,
  };
}

export async function createService(
  values: ServiceFormValues,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireCatalogEditor();
    const data = normalize(values);
    const row = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(services)
        .values({ ...data.service, createdBy: user.id })
        .returning({ id: services.id });
      await tx.insert(serviceVariants).values(
        data.variants.map((variant) => ({
          ...variant,
          serviceId: created.id,
          createdBy: user.id,
        })),
      );
      return created;
    });
    await ensureServiceLedgerAccount(row.id);
    await logActivity({
      entityType: "service",
      entityId: row.id,
      action: "service_ledger_account_linked",
      actorId: user.id,
    });
    revalidatePath("/services");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return handleActionError(err, "createService");
  }
}

export async function updateService(
  id: string,
  values: ServiceFormValues,
): Promise<ActionResult> {
  try {
    const user = await requireCatalogEditor();
    const data = normalize(values);
    await db.transaction(async (tx) => {
      await tx
        .update(services)
        .set({ ...data.service, updatedAt: new Date() })
        .where(eq(services.id, id));
      for (const variant of data.variants) {
        await tx
          .insert(serviceVariants)
          .values({
            ...variant,
            serviceId: id,
            createdBy: user.id,
          })
          .onConflictDoUpdate({
            target: [serviceVariants.serviceId, serviceVariants.tier],
            set: { ...variant, updatedAt: new Date() },
          });
      }
    });
    await ensureServiceLedgerAccount(id);
    await logActivity({
      entityType: "service",
      entityId: id,
      action: "service_ledger_account_linked",
      actorId: user.id,
    });
    revalidatePath("/services");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateService");
  }
}

export async function setServiceStatus(
  id: string,
  status: ServiceStatus,
): Promise<ActionResult> {
  try {
    await requireCatalogEditor();
    await db
      .update(services)
      .set({ status, updatedAt: new Date() })
      .where(eq(services.id, id));
    revalidatePath("/services");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "setServiceStatus");
  }
}
