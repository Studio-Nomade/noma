"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, count, eq, max, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  emailStudioAssets,
  emailStudioElements,
  emailStudioProjects,
  emailStudioTemplates,
} from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import {
  EMAIL_STUDIO_ASSETS_BUCKET,
  EMAIL_STUDIO_SOURCES_BUCKET,
  ensureBuckets,
  publicUrl,
  removeFromStorage,
  uploadToStorage,
} from "@/lib/supabase/storage";
import { optimizeEmailAsset } from "./asset-optimizer.server";
import { emailStudioIdSchema } from "./editor-schema";
import { getEditableEmailStudioProject } from "./project-state.server";

const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const REFERENCE_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, "application/pdf"]);
const MAX_REFERENCE_BYTES = 25 * 1024 * 1024;
const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const MAX_ASSET_BATCH_BYTES = 25 * 1024 * 1024;
const MAX_ASSETS_PER_UPLOAD = 12;

function fileLabel(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim()
      .slice(0, 120) || "Asset"
  );
}

async function removeQuietly(bucket: string, path: string) {
  try {
    await removeFromStorage(bucket, path);
  } catch (error) {
    console.error("[email-studio:storage:cleanup]", error);
  }
}

export async function uploadEmailStudioReference(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const projectId = emailStudioIdSchema.parse(
      String(formData.get("projectId") ?? ""),
    );
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecciona un PNG, JPG, WEBP o PDF." };
    }
    if (!REFERENCE_MIME_TYPES.has(file.type)) {
      return {
        ok: false,
        error: "La referencia debe ser PNG, JPG, WEBP o PDF.",
      };
    }
    if (file.size > MAX_REFERENCE_BYTES) {
      return { ok: false, error: "La referencia supera el máximo de 25 MB." };
    }
    const editable = await getEditableEmailStudioProject(projectId);
    if (!editable.ok) return editable;

    const original = Buffer.from(await file.arrayBuffer());
    if (
      file.type === "application/pdf" &&
      !original.subarray(0, 8).toString("latin1").includes("%PDF")
    ) {
      return { ok: false, error: "El archivo no parece un PDF válido." };
    }

    const assetId = randomUUID();
    const optimized =
      file.type === "application/pdf"
        ? null
        : await optimizeEmailAsset(original, file.type);
    const extension =
      file.type === "application/pdf" ? "pdf" : optimized!.extension;
    const mimeType =
      file.type === "application/pdf" ? file.type : optimized!.mimeType;
    const body = file.type === "application/pdf" ? original : optimized!.buffer;
    const storagePath = `${projectId}/reference/${assetId}.${extension}`;

    await ensureBuckets();
    const previousReferences = await db
      .select({ id: emailStudioAssets.id, path: emailStudioAssets.storagePath })
      .from(emailStudioAssets)
      .where(
        and(
          eq(emailStudioAssets.projectId, projectId),
          eq(emailStudioAssets.role, "reference"),
        ),
      );
    await uploadToStorage(
      EMAIL_STUDIO_SOURCES_BUCKET,
      storagePath,
      body,
      mimeType,
      {
        upsert: false,
      },
    );
    try {
      await db.transaction(async (tx) => {
        if (previousReferences.length > 0) {
          for (const previousAsset of previousReferences) {
            await tx
              .delete(emailStudioAssets)
              .where(eq(emailStudioAssets.id, previousAsset.id));
          }
        }
        await tx.insert(emailStudioAssets).values({
          id: assetId,
          projectId,
          role: "reference",
          label: "Diseño de referencia",
          originalName: file.name,
          storagePath,
          mimeType,
          sizeBytes: body.byteLength,
          width: optimized?.width ?? null,
          height: optimized?.height ?? null,
          optimized: Boolean(optimized),
          createdBy: user.id,
        });
        await tx
          .update(emailStudioProjects)
          .set({ updatedAt: new Date() })
          .where(eq(emailStudioProjects.id, projectId));
      });
    } catch (error) {
      await removeQuietly(EMAIL_STUDIO_SOURCES_BUCKET, storagePath);
      throw error;
    }
    await Promise.all(
      previousReferences.map((asset) =>
        removeQuietly(EMAIL_STUDIO_SOURCES_BUCKET, asset.path),
      ),
    );
    revalidatePath(`/email-studio/${projectId}`);
    revalidatePath("/email-studio");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "uploadEmailStudioReference");
  }
}

export async function uploadEmailStudioAssets(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const projectId = emailStudioIdSchema.parse(
      String(formData.get("projectId") ?? ""),
    );
    const files = formData
      .getAll("files")
      .filter(
        (entry): entry is File => entry instanceof File && entry.size > 0,
      );
    if (files.length === 0) {
      return { ok: false, error: "Selecciona al menos un asset." };
    }
    if (files.length > MAX_ASSETS_PER_UPLOAD) {
      return {
        ok: false,
        error: `Puedes subir hasta ${MAX_ASSETS_PER_UPLOAD} assets por vez.`,
      };
    }
    if (
      files.reduce((total, file) => total + file.size, 0) >
      MAX_ASSET_BATCH_BYTES
    ) {
      return {
        ok: false,
        error: "El conjunto de assets supera el máximo de 25 MB.",
      };
    }
    const invalid = files.find(
      (file) => !IMAGE_MIME_TYPES.has(file.type) || file.size > MAX_ASSET_BYTES,
    );
    if (invalid) {
      return {
        ok: false,
        error: `${invalid.name}: usa PNG, JPG o WEBP de máximo 10 MB.`,
      };
    }
    const editable = await getEditableEmailStudioProject(projectId);
    if (!editable.ok) return editable;
    const project = editable.project;
    await ensureBuckets();
    const prepared: Array<{
      id: string;
      storagePath: string;
      url: string;
      label: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      width: number;
      height: number;
    }> = [];
    try {
      for (const file of files) {
        const assetId = randomUUID();
        const optimized = await optimizeEmailAsset(
          Buffer.from(await file.arrayBuffer()),
          file.type,
        );
        const storagePath = `${project.clientId}/${projectId}/${assetId}.${optimized.extension}`;
        await uploadToStorage(
          EMAIL_STUDIO_ASSETS_BUCKET,
          storagePath,
          optimized.buffer,
          optimized.mimeType,
          { cacheControl: "31536000", upsert: false },
        );
        prepared.push({
          id: assetId,
          storagePath,
          url: publicUrl(EMAIL_STUDIO_ASSETS_BUCKET, storagePath),
          label: fileLabel(file.name),
          originalName: file.name,
          mimeType: optimized.mimeType,
          sizeBytes: optimized.buffer.byteLength,
          width: optimized.width,
          height: optimized.height,
        });
      }

      await db.transaction(async (tx) => {
        const [positionRow] = await tx
          .select({ value: max(emailStudioElements.position) })
          .from(emailStudioElements)
          .where(eq(emailStudioElements.projectId, projectId));
        const firstPosition = (positionRow?.value ?? -1) + 1;
        await tx.insert(emailStudioAssets).values(
          prepared.map((asset) => ({
            id: asset.id,
            projectId,
            role: "asset",
            label: asset.label,
            originalName: asset.originalName,
            storagePath: asset.storagePath,
            publicUrl: asset.url,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,
            width: asset.width,
            height: asset.height,
            optimized: true,
            createdBy: user.id,
          })),
        );
        await tx.insert(emailStudioElements).values(
          prepared.map((asset, index) => ({
            projectId,
            type: "image",
            position: firstPosition + index,
            assetId: asset.id,
            label: asset.label,
            alt: asset.label,
            align: "center",
            padding: "0px",
            createdBy: user.id,
          })),
        );
        await tx
          .update(emailStudioProjects)
          .set({ updatedAt: new Date() })
          .where(eq(emailStudioProjects.id, projectId));
      });
    } catch (error) {
      await Promise.all(
        prepared.map((asset) =>
          removeQuietly(EMAIL_STUDIO_ASSETS_BUCKET, asset.storagePath),
        ),
      );
      throw error;
    }
    revalidatePath(`/email-studio/${projectId}`);
    revalidatePath("/email-studio");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "uploadEmailStudioAssets");
  }
}

export async function replaceEmailStudioAsset(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireUser();
    const assetId = emailStudioIdSchema.parse(
      String(formData.get("assetId") ?? ""),
    );
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecciona el nuevo asset." };
    }
    if (!IMAGE_MIME_TYPES.has(file.type) || file.size > MAX_ASSET_BYTES) {
      return { ok: false, error: "Usa PNG, JPG o WEBP de máximo 10 MB." };
    }
    const [asset] = await db
      .select()
      .from(emailStudioAssets)
      .where(eq(emailStudioAssets.id, assetId))
      .limit(1);
    if (!asset || asset.role !== "asset" || asset.status !== "active") {
      return { ok: false, error: "Asset no encontrado." };
    }
    const editable = await getEditableEmailStudioProject(asset.projectId);
    if (!editable.ok) return editable;
    const optimized = await optimizeEmailAsset(
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
    const newPath = `${editable.project.clientId}/${asset.projectId}/${randomUUID()}.${optimized.extension}`;
    await uploadToStorage(
      EMAIL_STUDIO_ASSETS_BUCKET,
      newPath,
      optimized.buffer,
      optimized.mimeType,
      { cacheControl: "31536000", upsert: false },
    );
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(emailStudioAssets)
          .set({
            originalName: file.name,
            storagePath: newPath,
            publicUrl: publicUrl(EMAIL_STUDIO_ASSETS_BUCKET, newPath),
            mimeType: optimized.mimeType,
            sizeBytes: optimized.buffer.byteLength,
            width: optimized.width,
            height: optimized.height,
            optimized: true,
            updatedAt: new Date(),
          })
          .where(eq(emailStudioAssets.id, assetId));
        await tx
          .update(emailStudioProjects)
          .set({ updatedAt: new Date() })
          .where(eq(emailStudioProjects.id, asset.projectId));
      });
    } catch (error) {
      await removeQuietly(EMAIL_STUDIO_ASSETS_BUCKET, newPath);
      throw error;
    }
    revalidatePath(`/email-studio/${asset.projectId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "replaceEmailStudioAsset");
  }
}

export async function removeEmailStudioAsset(
  assetId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    const validId = emailStudioIdSchema.parse(assetId);
    const [asset] = await db
      .select()
      .from(emailStudioAssets)
      .where(eq(emailStudioAssets.id, validId))
      .limit(1);
    if (!asset || asset.status !== "active") {
      return { ok: false, error: "Asset no encontrado." };
    }
    const editable = await getEditableEmailStudioProject(asset.projectId);
    if (!editable.ok) return editable;
    const [{ value: templateCount }] = await db
      .select({ value: count() })
      .from(emailStudioTemplates)
      .where(
        and(
          eq(emailStudioTemplates.assetId, validId),
          eq(emailStudioTemplates.status, "active"),
        ),
      );
    if (templateCount > 0) {
      return {
        ok: false,
        error:
          "Este asset está ligado a una plantilla activa. Archiva la plantilla antes de retirarlo.",
      };
    }
    const [{ value: externalUses }] = await db
      .select({ value: count() })
      .from(emailStudioElements)
      .where(
        and(
          eq(emailStudioElements.assetId, validId),
          ne(emailStudioElements.projectId, asset.projectId),
        ),
      );
    if (externalUses > 0) {
      return {
        ok: false,
        error: "Este asset todavía se usa en otro proyecto del cliente.",
      };
    }
    await db.transaction(async (tx) => {
      await tx
        .delete(emailStudioElements)
        .where(
          and(
            eq(emailStudioElements.assetId, validId),
            eq(emailStudioElements.projectId, asset.projectId),
          ),
        );
      await tx
        .update(emailStudioAssets)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(emailStudioAssets.id, validId));
      await tx
        .update(emailStudioProjects)
        .set({ updatedAt: new Date() })
        .where(eq(emailStudioProjects.id, asset.projectId));
    });
    revalidatePath(`/email-studio/${asset.projectId}`);
    revalidatePath("/email-studio");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "removeEmailStudioAsset");
  }
}
