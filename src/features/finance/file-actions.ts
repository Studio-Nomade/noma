"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { finDocuments } from "@/db/schema";
import { requireFinance } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import {
  INVOICES_BUCKET,
  uploadToStorage,
  signedUrl,
  removeFromStorage,
} from "@/lib/supabase/storage";

export type FileKind = "pdf" | "xml";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

const ACCEPT: Record<FileKind, { ext: string; mime: string; magic?: string }> = {
  pdf: { ext: "pdf", mime: "application/pdf", magic: "%PDF" },
  xml: { ext: "xml", mime: "application/xml" },
};

/** Sube el PDF o XML de una factura al bucket privado y guarda su path. */
export async function uploadDocumentFile(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireFinance();
    const documentId = String(formData.get("documentId") ?? "");
    const kind = String(formData.get("kind") ?? "") as FileKind;
    const file = formData.get("file");

    if (!documentId || (kind !== "pdf" && kind !== "xml")) {
      return { ok: false, error: "Parámetros inválidos." };
    }
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecciona un archivo." };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, error: "El archivo supera los 15 MB." };
    }

    const spec = ACCEPT[kind];
    const buf = Buffer.from(await file.arrayBuffer());
    // Valida por contenido, no solo por extensión (el PDF tiene firma %PDF).
    if (spec.magic && !buf.subarray(0, 8).toString("latin1").includes(spec.magic)) {
      return { ok: false, error: `El archivo no parece un ${kind.toUpperCase()} válido.` };
    }

    const [doc] = await db
      .select({ id: finDocuments.id, folio: finDocuments.folio })
      .from(finDocuments)
      .where(eq(finDocuments.id, documentId))
      .limit(1);
    if (!doc) return { ok: false, error: "Documento no encontrado." };

    // Path estable por documento: sobrescribe si se vuelve a subir.
    const path = `${documentId}/${kind}.${spec.ext}`;
    await uploadToStorage(INVOICES_BUCKET, path, buf, spec.mime);

    await db
      .update(finDocuments)
      .set({
        [kind === "pdf" ? "pdfPath" : "xmlPath"]: path,
        updatedAt: new Date(),
      })
      .where(eq(finDocuments.id, documentId));

    await logActivity({
      entityType: "fin_document",
      entityId: documentId,
      action: `file_uploaded:${kind}`,
      actorId: user.id,
    });

    revalidatePath("/finanzas/ingresos");
    revalidatePath("/finanzas/egresos");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "uploadDocumentFile");
  }
}

/** Enlace firmado de descarga (corta duración) para el PDF/XML de una factura. */
export async function getDocumentFileUrl(
  documentId: string,
  kind: FileKind,
): Promise<ActionResult<{ url: string }>> {
  try {
    await requireFinance();
    const [doc] = await db
      .select({ pdfPath: finDocuments.pdfPath, xmlPath: finDocuments.xmlPath })
      .from(finDocuments)
      .where(eq(finDocuments.id, documentId))
      .limit(1);
    const path = kind === "pdf" ? doc?.pdfPath : doc?.xmlPath;
    if (!path) return { ok: false, error: "El archivo no está cargado." };

    const url = await signedUrl(INVOICES_BUCKET, path);
    if (!url) return { ok: false, error: "No se pudo generar el enlace." };
    return { ok: true, data: { url } };
  } catch (err) {
    return handleActionError(err, "getDocumentFileUrl");
  }
}

/** Quita el archivo (del bucket y de la fila). */
export async function removeDocumentFile(
  documentId: string,
  kind: FileKind,
): Promise<ActionResult> {
  try {
    const user = await requireFinance();
    const path = `${documentId}/${kind}.${ACCEPT[kind].ext}`;
    await removeFromStorage(INVOICES_BUCKET, path);
    await db
      .update(finDocuments)
      .set({
        [kind === "pdf" ? "pdfPath" : "xmlPath"]: null,
        updatedAt: new Date(),
      })
      .where(eq(finDocuments.id, documentId));
    await logActivity({
      entityType: "fin_document",
      entityId: documentId,
      action: `file_removed:${kind}`,
      actorId: user.id,
    });
    revalidatePath("/finanzas/ingresos");
    revalidatePath("/finanzas/egresos");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "removeDocumentFile");
  }
}
