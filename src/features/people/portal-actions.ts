"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  employeeDocuments,
  employees,
  employeeTimeOff,
  teamMembers,
} from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requirePeopleManager, requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import {
  ensureBuckets,
  PEOPLE_BUCKET,
  uploadToStorage,
} from "@/lib/supabase/storage";

const idSchema = z.string().uuid();
const linkSchema = z.object({
  employeeId: idSchema,
  teamMemberId: idSchema,
});
const documentSchema = z.object({
  employeeId: idSchema,
  category: z.enum([
    "contract",
    "annex",
    "payroll",
    "payment",
    "pension",
    "medical_leave",
    "vacation",
    "certificate",
    "other",
  ]),
  title: z.string().trim().min(2).max(160),
  period: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  notes: z.string().trim().max(500).optional(),
});
const requestSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    type: z.enum(["vacation", "permission", "medical_leave"]),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "La fecha de término debe ser posterior al inicio.",
  });

const FINANCE_CATEGORIES = new Set(["payroll", "payment", "pension"]);

export async function linkEmployeeToMember(
  employeeId: string,
  teamMemberId: string,
): Promise<ActionResult> {
  try {
    const user = await requirePeopleManager();
    const input = linkSchema.parse({ employeeId, teamMemberId });
    const [updated] = await db
      .update(employees)
      .set({ teamMemberId: input.teamMemberId, updatedAt: new Date() })
      .where(eq(employees.id, input.employeeId))
      .returning({ id: employees.id });
    if (!updated) return { ok: false, error: "Colaborador no encontrado." };
    await logActivity({
      entityType: "employee",
      entityId: updated.id,
      action: "employee_identity_linked",
      actorId: user.id,
    });
    revalidatePath("/personas");
    revalidatePath("/personas/colaboradores");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "linkEmployeeToMember");
  }
}

export async function uploadEmployeeDocument(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const input = documentSchema.parse(Object.fromEntries(formData));
    const role = roleFor(user.email);
    const allowed =
      role.canManagePeople ||
      (role.canFinance && FINANCE_CATEGORIES.has(input.category));
    if (!allowed) {
      return { ok: false, error: "No tienes permiso para esta categoría." };
    }
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) {
      return { ok: false, error: "Selecciona un archivo." };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { ok: false, error: "El archivo supera el máximo de 10 MB." };
    }
    const allowedMime = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    if (!allowedMime.has(file.type)) {
      return { ok: false, error: "Usa PDF, JPG, PNG o WEBP." };
    }
    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.id, input.employeeId))
      .limit(1);
    if (!employee) return { ok: false, error: "Colaborador no encontrado." };

    const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "bin";
    const path = `${employee.id}/${input.category}/${randomUUID()}.${extension}`;
    await ensureBuckets();
    await uploadToStorage(
      PEOPLE_BUCKET,
      path,
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
    const [document] = await db
      .insert(employeeDocuments)
      .values({
        employeeId: employee.id,
        category: input.category,
        title: input.title,
        period: input.period ?? null,
        storagePath: path,
        mimeType: file.type,
        visibility: "employee",
        notes: input.notes || null,
        createdBy: user.id,
      })
      .returning({ id: employeeDocuments.id });
    await logActivity({
      entityType: "employee_document",
      entityId: document.id,
      action: `employee_document_uploaded:${input.category}`,
      actorId: user.id,
    });
    revalidatePath("/personas");
    revalidatePath("/mi-portal");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "uploadEmployeeDocument");
  }
}

export async function requestTimeOff(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const input = requestSchema.parse(Object.fromEntries(formData));
    const email = user.email?.toLowerCase() ?? "";
    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .innerJoin(teamMembers, eq(employees.teamMemberId, teamMembers.id))
      .where(
        and(
          eq(employees.status, "ACTIVO"),
          // El user_id es la identidad principal; email permite el primer
          // acceso antes de que el callback haya persistido el vínculo.
          sql`${teamMembers.userId} = ${user.id} or lower(${teamMembers.email}) = ${email}`,
        ),
      )
      .limit(1);
    if (!employee) {
      return { ok: false, error: "Tu ficha laboral aún no está vinculada." };
    }
    const days = businessDays(input.startDate, input.endDate);
    const [request] = await db
      .insert(employeeTimeOff)
      .values({
        employeeId: employee.id,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        days: days.toFixed(2),
        reason: input.reason || null,
        createdBy: user.id,
      })
      .returning({ id: employeeTimeOff.id });
    await logActivity({
      entityType: "employee_time_off",
      entityId: request.id,
      action: "time_off_requested",
      actorId: user.id,
    });
    revalidatePath("/mi-portal");
    revalidatePath("/personas");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "requestTimeOff");
  }
}

export async function reviewTimeOff(
  id: string,
  decision: "approved" | "rejected",
): Promise<ActionResult> {
  try {
    const user = await requirePeopleManager();
    const requestId = idSchema.parse(id);
    const status = z.enum(["approved", "rejected"]).parse(decision);
    const [updated] = await db
      .update(employeeTimeOff)
      .set({
        status,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(employeeTimeOff.id, requestId),
          eq(employeeTimeOff.status, "pending"),
        ),
      )
      .returning({ id: employeeTimeOff.id });
    if (!updated) return { ok: false, error: "La solicitud ya fue resuelta." };
    await logActivity({
      entityType: "employee_time_off",
      entityId: updated.id,
      action: `time_off_${status}`,
      actorId: user.id,
    });
    revalidatePath("/personas");
    revalidatePath("/mi-portal");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "reviewTimeOff");
  }
}

function businessDays(start: string, end: string) {
  const cursor = new Date(`${start}T12:00:00Z`);
  const finish = new Date(`${end}T12:00:00Z`);
  let days = 0;
  while (cursor <= finish) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
