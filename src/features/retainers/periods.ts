import "server-only";

import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  clientRequests,
  retainerPeriods,
  retainers,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";

const EPSILON = 0.001;

function number(value: string | number) {
  return Number(value);
}

function decimal(value: number) {
  return value.toFixed(2);
}

export function monthlyPeriodBounds(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export async function ensureCurrentPeriod(retainerId: string, date = new Date()) {
  const bounds = monthlyPeriodBounds(date);
  const [existing] = await db
    .select()
    .from(retainerPeriods)
    .where(
      and(
        eq(retainerPeriods.retainerId, retainerId),
        eq(retainerPeriods.periodStart, bounds.start),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [retainer] = await db
    .select()
    .from(retainers)
    .where(eq(retainers.id, retainerId))
    .limit(1);
  if (!retainer || retainer.status !== "active") return null;
  if (retainer.startDate > bounds.end) return null;
  if (retainer.endDate && retainer.endDate < bounds.start) return null;

  let quota = number(retainer.quotaPerPeriod);
  if (retainer.rolloverPolicy === "partial") {
    const [previous] = await db
      .select({ remaining: retainerPeriods.remaining })
      .from(retainerPeriods)
      .where(
        and(
          eq(retainerPeriods.retainerId, retainerId),
          lt(retainerPeriods.periodStart, bounds.start),
        ),
      )
      .orderBy(desc(retainerPeriods.periodStart))
      .limit(1);
    quota += Math.max(0, number(previous?.remaining ?? 0));
  }

  const [created] = await db
    .insert(retainerPeriods)
    .values({
      retainerId,
      periodStart: bounds.start,
      periodEnd: bounds.end,
      quota: decimal(quota),
      remaining: decimal(quota),
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [winner] = await db
    .select()
    .from(retainerPeriods)
    .where(
      and(
        eq(retainerPeriods.retainerId, retainerId),
        eq(retainerPeriods.periodStart, bounds.start),
      ),
    )
    .limit(1);
  return winner ?? null;
}

export async function consume(
  retainerPeriodId: string,
  units: number,
  actorId?: string | null,
) {
  if (!Number.isFinite(units) || units <= 0) {
    return { ok: false as const, reason: "Las unidades deben ser positivas." };
  }
  const result = await db.transaction(async (tx) => {
    const [period] = await tx
      .select()
      .from(retainerPeriods)
      .where(eq(retainerPeriods.id, retainerPeriodId))
      .for("update")
      .limit(1);
    if (!period || period.status !== "open") {
      return { ok: false as const, reason: "El período no está disponible." };
    }
    const remaining = number(period.remaining);
    if (remaining + EPSILON < units) {
      return {
        ok: false as const,
        reason: "El período no tiene saldo suficiente.",
      };
    }
    const consumed = number(period.consumed) + units;
    const nextRemaining = Math.max(0, number(period.quota) - consumed);
    await tx
      .update(retainerPeriods)
      .set({
        consumed: decimal(consumed),
        remaining: decimal(nextRemaining),
        updatedAt: new Date(),
      })
      .where(eq(retainerPeriods.id, retainerPeriodId));
    return { ok: true as const, remaining: nextRemaining };
  });
  if (result.ok) {
    await logActivity({
      entityType: "retainer_period",
      entityId: retainerPeriodId,
      action: `units_consumed:${decimal(units)}`,
      actorId,
    });
  }
  return result;
}

export async function release(
  retainerPeriodId: string,
  units: number,
  actorId?: string | null,
) {
  if (!Number.isFinite(units) || units <= 0) {
    return { ok: false as const, reason: "Las unidades deben ser positivas." };
  }
  const result = await db.transaction(async (tx) => {
    const [period] = await tx
      .select()
      .from(retainerPeriods)
      .where(eq(retainerPeriods.id, retainerPeriodId))
      .for("update")
      .limit(1);
    if (!period) {
      return { ok: false as const, reason: "Período no encontrado." };
    }
    const consumed = Math.max(0, number(period.consumed) - units);
    const remaining = Math.max(0, number(period.quota) - consumed);
    await tx
      .update(retainerPeriods)
      .set({
        consumed: decimal(consumed),
        remaining: decimal(remaining),
        updatedAt: new Date(),
      })
      .where(eq(retainerPeriods.id, retainerPeriodId));
    return { ok: true as const, remaining };
  });
  if (result.ok) {
    await logActivity({
      entityType: "retainer_period",
      entityId: retainerPeriodId,
      action: `units_released:${decimal(units)}`,
      actorId,
    });
  }
  return result;
}

/**
 * Descuenta una solicitud una sola vez. El lock del request evita que dos
 * workers concurrentes consuman dos veces durante reintentos de WhatsApp.
 */
export async function consumeRequest(requestId: string) {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select({
        periodId: clientRequests.retainerPeriodId,
        units: clientRequests.estimatedUnits,
        consumedAt: clientRequests.retainerConsumedAt,
      })
      .from(clientRequests)
      .where(eq(clientRequests.id, requestId))
      .for("update")
      .limit(1);
    if (!request?.periodId || !request.units) {
      return { ok: false as const, reason: "Solicitud sin consumo asociado." };
    }
    if (request.consumedAt) return { ok: true as const, duplicate: true };

    const [period] = await tx
      .select()
      .from(retainerPeriods)
      .where(eq(retainerPeriods.id, request.periodId))
      .for("update")
      .limit(1);
    const units = number(request.units);
    if (
      !period ||
      period.status !== "open" ||
      number(period.remaining) + EPSILON < units
    ) {
      return { ok: false as const, reason: "Saldo insuficiente." };
    }
    const consumed = number(period.consumed) + units;
    await tx
      .update(retainerPeriods)
      .set({
        consumed: decimal(consumed),
        remaining: decimal(Math.max(0, number(period.quota) - consumed)),
        updatedAt: new Date(),
      })
      .where(eq(retainerPeriods.id, period.id));
    await tx
      .update(clientRequests)
      .set({ retainerConsumedAt: new Date(), updatedAt: new Date() })
      .where(eq(clientRequests.id, requestId));
    await logActivity(
      {
        entityType: "client_request",
        entityId: requestId,
        action: `retainer_consumed:${decimal(units)}`,
      },
      tx,
    );
    return { ok: true as const, duplicate: false };
  });
}

export async function openCurrentRetainerPeriods(date = new Date()) {
  const rows = await db
    .select({ id: retainers.id })
    .from(retainers)
    .where(eq(retainers.status, "active"));
  const results = await Promise.all(
    rows.map((row) => ensureCurrentPeriod(row.id, date)),
  );
  return results.filter(Boolean).length;
}
