"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, max } from "drizzle-orm";
import { db } from "@/db";
import {
  emailStudioAssets,
  emailStudioElements,
  emailStudioProjects,
  emailStudioTemplates,
  emailStudioVariables,
} from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import {
  emailStudioElementInputSchema,
  emailStudioIdSchema,
  emailStudioImageElementSchema,
  emailStudioSettingsSchema,
  emailStudioTemplateInputSchema,
  emailStudioTemplateInsertSchema,
  emailStudioTemplateStatusSchema,
  emailStudioVariableInputSchema,
  type EmailStudioElementInput,
  type EmailStudioImageElementInput,
  type EmailStudioSettingsInput,
  type EmailStudioTemplateInput,
  type EmailStudioVariableInput,
} from "./editor-schema";
import { getEditableEmailStudioProject } from "./project-state.server";

async function touchProject(projectId: string) {
  await db
    .update(emailStudioProjects)
    .set({ updatedAt: new Date() })
    .where(eq(emailStudioProjects.id, projectId));
  revalidatePath(`/email-studio/${projectId}`);
  revalidatePath("/email-studio");
}

async function nextPosition(projectId: string): Promise<number> {
  const [row] = await db
    .select({ value: max(emailStudioElements.position) })
    .from(emailStudioElements)
    .where(eq(emailStudioElements.projectId, projectId));
  return (row?.value ?? -1) + 1;
}

export async function saveEmailStudioSettings(
  values: EmailStudioSettingsInput,
): Promise<ActionResult> {
  try {
    await requireUser();
    const data = emailStudioSettingsSchema.parse(values);
    const editable = await getEditableEmailStudioProject(data.projectId);
    if (!editable.ok) return editable;
    const [updated] = await db
      .update(emailStudioProjects)
      .set({
        subject: data.subject,
        previewText: data.previewText,
        emailWidth: data.emailWidth,
        canvasColor: data.canvasColor,
        bodyColor: data.bodyColor,
        textColor: data.textColor,
        updatedAt: new Date(),
      })
      .where(eq(emailStudioProjects.id, data.projectId))
      .returning({ id: emailStudioProjects.id });
    if (!updated) return { ok: false, error: "Proyecto no encontrado." };
    revalidatePath(`/email-studio/${data.projectId}`);
    revalidatePath("/email-studio");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "saveEmailStudioSettings");
  }
}

export async function saveEmailStudioElement(
  values: EmailStudioElementInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const data = emailStudioElementInputSchema.parse(values);
    const editable = await getEditableEmailStudioProject(data.projectId);
    if (!editable.ok) return editable;
    if (data.type !== "spacer" && !data.content?.trim()) {
      return { ok: false, error: "El contenido es obligatorio." };
    }
    if (data.type === "button" && !data.href?.trim()) {
      return { ok: false, error: "El botón necesita un enlace." };
    }

    const normalized = {
      type: data.type,
      label: data.label,
      content: data.type === "spacer" ? data.content || "24" : data.content,
      href: data.href || null,
      align: data.align,
      fontSize: data.fontSize,
      color: data.color,
      backgroundColor: data.backgroundColor,
      updatedAt: new Date(),
    };

    let id = data.id || null;
    if (id) {
      const [updated] = await db
        .update(emailStudioElements)
        .set(normalized)
        .where(
          and(
            eq(emailStudioElements.id, id),
            eq(emailStudioElements.projectId, data.projectId),
          ),
        )
        .returning({ id: emailStudioElements.id });
      if (!updated) return { ok: false, error: "Elemento no encontrado." };
    } else {
      const [created] = await db
        .insert(emailStudioElements)
        .values({
          ...normalized,
          projectId: data.projectId,
          position: await nextPosition(data.projectId),
          createdBy: user.id,
        })
        .returning({ id: emailStudioElements.id });
      id = created.id;
    }

    await touchProject(data.projectId);
    return { ok: true, data: { id } };
  } catch (error) {
    return handleActionError(error, "saveEmailStudioElement");
  }
}

export async function updateEmailStudioImageElement(
  values: EmailStudioImageElementInput,
): Promise<ActionResult> {
  try {
    await requireUser();
    const data = emailStudioImageElementSchema.parse(values);
    const editable = await getEditableEmailStudioProject(data.projectId);
    if (!editable.ok) return editable;
    const [updated] = await db
      .update(emailStudioElements)
      .set({
        label: data.label,
        alt: data.alt,
        href: data.href || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emailStudioElements.id, data.id),
          eq(emailStudioElements.projectId, data.projectId),
        ),
      )
      .returning({ id: emailStudioElements.id });
    if (!updated) return { ok: false, error: "Elemento no encontrado." };
    await touchProject(data.projectId);
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "updateEmailStudioImageElement");
  }
}

export async function deleteEmailStudioElement(
  projectId: string,
  elementId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    const validProjectId = emailStudioIdSchema.parse(projectId);
    const validElementId = emailStudioIdSchema.parse(elementId);
    const editable = await getEditableEmailStudioProject(validProjectId);
    if (!editable.ok) return editable;
    await db
      .delete(emailStudioElements)
      .where(
        and(
          eq(emailStudioElements.id, validElementId),
          eq(emailStudioElements.projectId, validProjectId),
        ),
      );
    await touchProject(validProjectId);
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "deleteEmailStudioElement");
  }
}

export async function moveEmailStudioElement(
  projectId: string,
  elementId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  try {
    await requireUser();
    const validProjectId = emailStudioIdSchema.parse(projectId);
    const validElementId = emailStudioIdSchema.parse(elementId);
    const editable = await getEditableEmailStudioProject(validProjectId);
    if (!editable.ok) return editable;
    const rows = await db
      .select({
        id: emailStudioElements.id,
        position: emailStudioElements.position,
      })
      .from(emailStudioElements)
      .where(eq(emailStudioElements.projectId, validProjectId))
      .orderBy(asc(emailStudioElements.position));
    const index = rows.findIndex((row) => row.id === validElementId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= rows.length) {
      return { ok: true, data: undefined };
    }
    const current = rows[index];
    const target = rows[targetIndex];
    await db.transaction(async (tx) => {
      await tx
        .update(emailStudioElements)
        .set({ position: target.position, updatedAt: new Date() })
        .where(eq(emailStudioElements.id, current.id));
      await tx
        .update(emailStudioElements)
        .set({ position: current.position, updatedAt: new Date() })
        .where(eq(emailStudioElements.id, target.id));
    });
    await touchProject(validProjectId);
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "moveEmailStudioElement");
  }
}

export async function saveEmailStudioVariable(
  values: EmailStudioVariableInput,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = emailStudioVariableInputSchema.parse(values);
    const editable = await getEditableEmailStudioProject(data.projectId);
    if (!editable.ok) return editable;
    await db
      .insert(emailStudioVariables)
      .values({ ...data, createdBy: user.id })
      .onConflictDoUpdate({
        target: [emailStudioVariables.projectId, emailStudioVariables.key],
        set: {
          label: data.label,
          sample: data.sample,
          required: data.required,
          updatedAt: new Date(),
        },
      });
    await touchProject(data.projectId);
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "saveEmailStudioVariable");
  }
}

export async function deleteEmailStudioVariable(
  projectId: string,
  variableId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    const validProjectId = emailStudioIdSchema.parse(projectId);
    const validVariableId = emailStudioIdSchema.parse(variableId);
    const editable = await getEditableEmailStudioProject(validProjectId);
    if (!editable.ok) return editable;
    await db
      .delete(emailStudioVariables)
      .where(
        and(
          eq(emailStudioVariables.id, validVariableId),
          eq(emailStudioVariables.projectId, validProjectId),
        ),
      );
    await touchProject(validProjectId);
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "deleteEmailStudioVariable");
  }
}

export async function createEmailStudioTemplate(
  values: EmailStudioTemplateInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const data = emailStudioTemplateInputSchema.parse(values);
    const editable = await getEditableEmailStudioProject(data.projectId);
    if (!editable.ok) return editable;
    const [source] = await db
      .select({
        assetId: emailStudioAssets.id,
        clientId: emailStudioProjects.clientId,
      })
      .from(emailStudioAssets)
      .innerJoin(
        emailStudioProjects,
        eq(emailStudioAssets.projectId, emailStudioProjects.id),
      )
      .where(
        and(
          eq(emailStudioAssets.id, data.assetId),
          eq(emailStudioAssets.projectId, data.projectId),
          eq(emailStudioAssets.role, "asset"),
          eq(emailStudioAssets.status, "active"),
        ),
      )
      .limit(1);
    if (!source) return { ok: false, error: "Asset no encontrado." };
    const [created] = await db
      .insert(emailStudioTemplates)
      .values({
        clientId: source.clientId,
        sourceProjectId: data.projectId,
        assetId: data.assetId,
        name: data.name,
        description: data.description || null,
        alt: data.alt,
        href: data.href || null,
        createdBy: user.id,
      })
      .returning({ id: emailStudioTemplates.id });
    revalidatePath(`/email-studio/${data.projectId}`);
    return { ok: true, data: created };
  } catch (error) {
    return handleActionError(error, "createEmailStudioTemplate");
  }
}

export async function insertEmailStudioTemplate(
  projectId: string,
  templateId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const data = emailStudioTemplateInsertSchema.parse({
      projectId,
      templateId,
    });
    const editable = await getEditableEmailStudioProject(data.projectId);
    if (!editable.ok) return editable;
    const [template] = await db
      .select({
        id: emailStudioTemplates.id,
        name: emailStudioTemplates.name,
        assetId: emailStudioTemplates.assetId,
        alt: emailStudioTemplates.alt,
        href: emailStudioTemplates.href,
        clientId: emailStudioTemplates.clientId,
        projectClientId: emailStudioProjects.clientId,
      })
      .from(emailStudioTemplates)
      .innerJoin(
        emailStudioProjects,
        eq(emailStudioProjects.id, data.projectId),
      )
      .innerJoin(
        emailStudioAssets,
        eq(emailStudioAssets.id, emailStudioTemplates.assetId),
      )
      .where(
        and(
          eq(emailStudioTemplates.id, data.templateId),
          eq(emailStudioTemplates.status, "active"),
          eq(emailStudioAssets.status, "active"),
        ),
      )
      .limit(1);
    if (!template || template.clientId !== template.projectClientId) {
      return {
        ok: false,
        error: "La plantilla no pertenece al cliente de este proyecto.",
      };
    }
    const [created] = await db
      .insert(emailStudioElements)
      .values({
        projectId: data.projectId,
        type: "template",
        position: await nextPosition(data.projectId),
        assetId: template.assetId,
        templateId: template.id,
        label: template.name,
        alt: template.alt,
        href: template.href,
        padding: "0px",
        createdBy: user.id,
      })
      .returning({ id: emailStudioElements.id });
    await touchProject(data.projectId);
    return { ok: true, data: created };
  } catch (error) {
    return handleActionError(error, "insertEmailStudioTemplate");
  }
}

export async function setEmailStudioTemplateStatus(
  projectId: string,
  templateId: string,
  status: "active" | "archived",
): Promise<ActionResult> {
  try {
    await requireUser();
    const validProjectId = emailStudioIdSchema.parse(projectId);
    const validTemplateId = emailStudioIdSchema.parse(templateId);
    const nextStatus = emailStudioTemplateStatusSchema.parse(status);
    const editable = await getEditableEmailStudioProject(validProjectId);
    if (!editable.ok) return editable;
    const [project] = await db
      .select({ clientId: emailStudioProjects.clientId })
      .from(emailStudioProjects)
      .where(eq(emailStudioProjects.id, validProjectId))
      .limit(1);
    if (!project) return { ok: false, error: "Proyecto no encontrado." };
    if (nextStatus === "active") {
      const [asset] = await db
        .select({ status: emailStudioAssets.status })
        .from(emailStudioTemplates)
        .innerJoin(
          emailStudioAssets,
          eq(emailStudioAssets.id, emailStudioTemplates.assetId),
        )
        .where(eq(emailStudioTemplates.id, validTemplateId))
        .limit(1);
      if (!asset || asset.status !== "active") {
        return {
          ok: false,
          error: "El asset de esta plantilla ya no está activo.",
        };
      }
    }
    const [updated] = await db
      .update(emailStudioTemplates)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(
        and(
          eq(emailStudioTemplates.id, validTemplateId),
          eq(emailStudioTemplates.clientId, project.clientId),
        ),
      )
      .returning({ id: emailStudioTemplates.id });
    if (!updated) return { ok: false, error: "Plantilla no encontrada." };
    revalidatePath(`/email-studio/${validProjectId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "setEmailStudioTemplateStatus");
  }
}
