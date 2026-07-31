"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { serviceSubareas, serviceVariants, services } from "@/db/schema";
import { requireCatalogEditor } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { ensureServiceLedgerAccount } from "@/features/finance/plan-accounts/service-link";
import { serviceSchema, type ServiceFormValues } from "./schema";
import { normalizeRichTextStorage } from "./rich-text";
import type { ServiceStatus } from "@/types/enums";
import { SERVICE_STATUSES } from "@/types/enums";

const serviceIdSchema = z.string().uuid("Identificador de servicio inválido.");

async function assertSubarea(
  writer: Pick<typeof db, "select">,
  area: ServiceFormValues["area"],
  subarea: string | null,
) {
  if (!subarea) return;
  const [row] = await writer
    .select({ id: serviceSubareas.id })
    .from(serviceSubareas)
    .where(
      and(eq(serviceSubareas.area, area), eq(serviceSubareas.name, subarea)),
    )
    .limit(1);
  if (!row) {
    z.boolean()
      .refine(Boolean, {
        message: "La subárea seleccionada no pertenece al área del servicio.",
      })
      .parse(false);
  }
}

function normalize(values: ServiceFormValues) {
  const d = serviceSchema.parse(values);
  const emptyToNull = (v?: string) => (v && v.trim() !== "" ? v : null);
  const variants = d.variants.map((variant) => ({
    ...variant,
    audience: emptyToNull(variant.audience),
    focus: emptyToNull(variant.focus),
    description: emptyToNull(variant.description),
    methodology: emptyToNull(
      normalizeRichTextStorage(variant.methodology, "stages"),
    ),
    deliverables: emptyToNull(
      normalizeRichTextStorage(variant.deliverables, "deliverables"),
    ),
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
      await assertSubarea(tx, data.service.area, data.service.subarea);
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
    const serviceId = serviceIdSchema.parse(id);
    const data = normalize(values);
    await db.transaction(async (tx) => {
      await assertSubarea(tx, data.service.area, data.service.subarea);
      await tx
        .update(services)
        .set({ ...data.service, updatedAt: new Date() })
        .where(eq(services.id, serviceId));
      for (const variant of data.variants) {
        await tx
          .insert(serviceVariants)
          .values({
            ...variant,
            serviceId,
            createdBy: user.id,
          })
          .onConflictDoUpdate({
            target: [serviceVariants.serviceId, serviceVariants.tier],
            set: { ...variant, updatedAt: new Date() },
          });
      }
    });
    await ensureServiceLedgerAccount(serviceId);
    await logActivity({
      entityType: "service",
      entityId: serviceId,
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
    const input = z
      .object({
        id: serviceIdSchema,
        status: z.enum(SERVICE_STATUSES),
      })
      .parse({ id, status });
    await db
      .update(services)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(services.id, input.id));
    revalidatePath("/services");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "setServiceStatus");
  }
}
