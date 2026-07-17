import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { classificationRules, type ClassificationRule } from "@/db/schema";

export interface ClassifyContext {
  rut: string;
  nombre: string;
  total: number;
  glosa?: string;
}

export interface ClassifyResult {
  ledgerAccountId: string | null;
  costCenterId: string | null;
  businessLineId: string | null;
}

export async function loadActiveRules(): Promise<ClassificationRule[]> {
  return db
    .select()
    .from(classificationRules)
    .where(eq(classificationRules.isActive, true))
    .orderBy(asc(classificationRules.priority));
}

function matches(rule: ClassificationRule, ctx: ClassifyContext): boolean {
  const val = rule.matchValue.trim().toLowerCase();
  const op = rule.matchOperator;

  switch (rule.matchField) {
    case "RUT":
      return op === "contains"
        ? ctx.rut.toLowerCase().includes(val)
        : ctx.rut.toLowerCase() === val;
    case "CONTACTO":
      return ctx.nombre.toLowerCase().includes(val);
    case "GLOSA":
      return (ctx.glosa ?? "").toLowerCase().includes(val);
    case "MONTO": {
      const num = Number(val);
      if (Number.isNaN(num)) return false;
      if (op === "gte") return ctx.total >= num;
      if (op === "lte") return ctx.total <= num;
      return ctx.total === num;
    }
    default:
      return false;
  }
}

/** Devuelve la primera regla que aplica (ya ordenadas por prioridad). */
export function classify(
  rules: ClassificationRule[],
  ctx: ClassifyContext,
): ClassifyResult {
  for (const rule of rules) {
    if (matches(rule, ctx)) {
      return {
        ledgerAccountId: rule.ledgerAccountId ?? null,
        costCenterId: rule.costCenterId ?? null,
        businessLineId: rule.businessLineId ?? null,
      };
    }
  }
  return { ledgerAccountId: null, costCenterId: null, businessLineId: null };
}
