"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { serviceSchema, type ServiceFormValues } from "./schema";
import type { ServiceStatus } from "@/types/enums";

function normalize(values: ServiceFormValues) {
  const d = serviceSchema.parse(values);
  const emptyToNull = (v?: string) => (v && v.trim() !== "" ? v : null);
  // Descarta filas de entregable sin título; recorta la descripción vacía.
  const deliverableItems = (d.deliverableItems ?? [])
    .map((item) => ({
      title: item.title.trim(),
      description: item.description?.trim() || undefined,
    }))
    .filter((item) => item.title !== "");
  return {
    name: d.name,
    area: d.area,
    subarea: emptyToNull(d.subarea),
    description: emptyToNull(d.description),
    deliverables: emptyToNull(d.deliverables),
    deliverableItems,
    estimatedTime: emptyToNull(d.estimatedTime),
    priceMinAmount: emptyToNull(d.priceMinAmount),
    priceMaxAmount: emptyToNull(d.priceMaxAmount),
    priceCurrency: d.priceCurrency,
    requirements: emptyToNull(d.requirements),
    status: d.status,
  };
}

export async function createService(
  values: ServiceFormValues,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const data = normalize(values);
    const [row] = await db
      .insert(services)
      .values({ ...data, createdBy: user.id })
      .returning({ id: services.id });
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
    await requireUser();
    const data = normalize(values);
    await db
      .update(services)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(services.id, id));
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
    await requireUser();
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
