"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { AREAS } from "@/types/enums";
import { isRealRut, normalizeRut } from "@/lib/text/rut";

const employeeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  rut: z.string().trim().refine(isRealRut, "Ingresa un RUT válido."),
  roleTitle: z.string().trim().min(2).max(120),
  area: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(AREAS).optional(),
  ),
  baseSalaryAmount: z.coerce.number().positive().max(999_999_999),
  baseSalaryCurrency: z.enum(["CLP", "UF", "USD"]).default("CLP"),
  startDate: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ),
});

export async function createEmployee(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const role = roleFor(user.email);
    if (!role.canFinance && !role.canManagePeople) {
      return { ok: false, error: "No tienes permiso para crear empleados." };
    }
    const input = employeeSchema.parse(Object.fromEntries(formData));
    const [employee] = await db
      .insert(employees)
      .values({
        ...input,
        rut: normalizeRut(input.rut)!,
        area: input.area || null,
        baseSalaryAmount: input.baseSalaryAmount.toFixed(2),
        startDate: input.startDate ?? null,
        createdBy: user.id,
      })
      .returning({ id: employees.id });
    await logActivity({
      entityType: "employee",
      entityId: employee.id,
      action: "employee_created",
      actorId: user.id,
    });
    revalidatePath("/personas/empleados");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "createEmployee");
  }
}
