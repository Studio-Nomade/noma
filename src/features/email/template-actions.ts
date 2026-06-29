"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import type { Area } from "@/types/enums";

type TemplateInput = {
  name: string;
  area: Area | null;
  subject: string;
  body: string;
};

export async function createEmailTemplate(
  input: TemplateInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireUser();
    if (!input.name.trim() || !input.subject.trim() || !input.body.trim()) {
      return { ok: false, error: "Nombre, asunto y cuerpo son obligatorios." };
    }
    const [row] = await db
      .insert(emailTemplates)
      .values({
        name: input.name.trim(),
        area: input.area,
        subject: input.subject.trim(),
        body: input.body,
      })
      .returning({ id: emailTemplates.id });
    revalidatePath("/settings/email-templates");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return handleActionError(err, "createEmailTemplate");
  }
}

export async function updateEmailTemplate(
  id: string,
  input: TemplateInput,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db
      .update(emailTemplates)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(emailTemplates.id, id));
    revalidatePath("/settings/email-templates");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateEmailTemplate");
  }
}

export async function deleteEmailTemplate(id: string): Promise<ActionResult> {
  try {
    await requireUser();
    await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
    revalidatePath("/settings/email-templates");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "deleteEmailTemplate");
  }
}
