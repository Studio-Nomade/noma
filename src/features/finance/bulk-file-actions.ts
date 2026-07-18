"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  finDocuments,
  finDocumentLines,
  businessLines,
  services,
} from "@/db/schema";
import { requireFinance } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { INVOICES_BUCKET, uploadToStorage } from "@/lib/supabase/storage";
import { parseDte, decodeXml, type DteLine } from "./import/dte-xml";
import {
  detectArea,
  matchService,
  type ServiceRef,
} from "./classify-lines";
import type { Area, DocumentDirection } from "@/types/enums";

const MAX_FILES = 400;
const MAX_BYTES = 15 * 1024 * 1024;

export type BulkFileResult = {
  attached: number;
  unmatched: { file: string; reason: string }[];
  matchedFolios: string[];
  /** Documentos cuyo detalle se extrajo del XML (líneas + clasificación). */
  extracted: number;
};

type DocUpdate = {
  pdf?: string;
  xml?: string;
  lines?: DteLine[];
  businessLineId?: string | null;
  serviceId?: string | null;
};

/**
 * Clase de documento para desambiguar folios repetidos. En Chile FAC-EL
 * (afecta) y FAC-EE (exenta) usan secuencias de folio SEPARADAS, así que el
 * mismo folio existe para ambas (y ambas son FACTURA_VENTA en el enum). La
 * clase, deducida del prefijo del archivo y de los montos del documento,
 * distingue cuál es cuál.
 */
type DocClass = "afecta" | "exenta" | "nota" | "boleta";

/**
 * Nomenclatura de Studio Nomade: `TIPO_FOLIO_RUT` (ej. FAC-EL_450_76160170-9,
 * FAC-EE_699_...). El folio es el número inmediatamente después del prefijo;
 * el prefijo define la clase.
 */
function parseFileName(fileName: string): { folio: string; klass: DocClass | null } | null {
  const base = fileName.replace(/\.[^.]+$/, "");
  const parts = base.split("_");
  if (parts.length < 2) return null;

  const prefix = parts[0].toUpperCase().replace(/[^A-Z]/g, "");
  const folioRaw = parts[1].trim();
  if (!/^\d+$/.test(folioRaw)) return null;
  const folio = folioRaw.replace(/^0+(?=\d)/, "");

  let klass: DocClass | null = null;
  if (prefix.startsWith("FACEL")) klass = "afecta";
  else if (prefix.startsWith("FACEE")) klass = "exenta";
  else if (prefix.startsWith("NC") || prefix.startsWith("NCEL")) klass = "nota";
  else if (prefix.startsWith("BOL")) klass = "boleta";

  return { folio, klass };
}

/** Clase de un documento ya guardado, según su tipo y montos. */
function docClass(type: string, iva: number, exento: number): DocClass {
  if (type === "NOTA_CREDITO") return "nota";
  if (type === "BOLETA" || type === "BOLETA_HONORARIOS") return "boleta";
  // Factura: exenta si no tiene IVA (todo exento); afecta si tiene IVA.
  return iva > 0 || exento === 0 ? "afecta" : "exenta";
}

/**
 * Carga masiva de PDF/XML de facturas: enlaza cada archivo con su documento por
 * folio (leído del nombre) y lo guarda en el bucket privado.
 *
 * La extracción del detalle del XML (para clasificar en servicio/plan de
 * cuentas) se hace en un paso posterior; aquí solo se adjuntan los archivos.
 */
export async function bulkUploadFiles(
  formData: FormData,
): Promise<ActionResult<BulkFileResult>> {
  try {
    const user = await requireFinance();
    const direction = String(formData.get("direction") ?? "") as DocumentDirection;
    if (direction !== "VENTA" && direction !== "COMPRA") {
      return { ok: false, error: "Dirección inválida." };
    }
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) return { ok: false, error: "No hay archivos." };
    if (files.length > MAX_FILES) {
      return { ok: false, error: `Máximo ${MAX_FILES} archivos por carga.` };
    }

    // Índice folio|clase → documentId(s). La clase desambigua folios repetidos
    // entre facturas afectas/exentas/notas/boletas.
    const docs = await db
      .select({
        id: finDocuments.id,
        folio: finDocuments.folio,
        type: finDocuments.type,
        iva: finDocuments.iva,
        exento: finDocuments.exento,
      })
      .from(finDocuments)
      .where(eq(finDocuments.direction, direction));
    // Doble índice: por folio|clase (preciso) y por folio (respaldo).
    const byFolioClass = new Map<string, string[]>();
    const byFolio = new Map<string, string[]>();
    for (const d of docs) {
      const folio = d.folio.replace(/^0+(?=\d)/, "");
      const klass = docClass(d.type, Number(d.iva ?? 0), Number(d.exento ?? 0));
      const ck = `${folio}|${klass}`;
      (byFolioClass.get(ck) ?? byFolioClass.set(ck, []).get(ck)!).push(d.id);
      (byFolio.get(folio) ?? byFolio.set(folio, []).get(folio)!).push(d.id);
    }

    // Catálogos para clasificar el detalle (una consulta cada uno).
    const blRows = await db
      .select({ id: businessLines.id, code: businessLines.code })
      .from(businessLines);
    const blByArea = new Map<string, string>();
    for (const b of blRows) if (b.code) blByArea.set(b.code, b.id);
    const svcRows = (await db
      .select({ id: services.id, name: services.name, area: services.area })
      .from(services)) as ServiceRef[];

    const result: BulkFileResult = {
      attached: 0,
      unmatched: [],
      matchedFolios: [],
      extracted: 0,
    };
    const updates = new Map<string, DocUpdate>();

    for (const file of files) {
      const name = file.name;
      const ext = name.toLowerCase().match(/\.(pdf|xml)$/)?.[1] as
        | "pdf"
        | "xml"
        | undefined;
      if (!ext) {
        result.unmatched.push({ file: name, reason: "No es PDF ni XML." });
        continue;
      }
      if (file.size === 0 || file.size > MAX_BYTES) {
        result.unmatched.push({ file: name, reason: "Archivo vacío o >15 MB." });
        continue;
      }

      // Folio + clase desde el nombre (nomenclatura TIPO_FOLIO_RUT).
      const parsed = parseFileName(name);
      if (!parsed) {
        result.unmatched.push({
          file: name,
          reason: "Nombre sin folio reconocible (usa TIPO_FOLIO_RUT).",
        });
        continue;
      }
      const { folio, klass } = parsed;
      // Con clase: match exacto por folio|clase. Sin clase: por folio (si es único).
      const ids = klass
        ? (byFolioClass.get(`${folio}|${klass}`) ?? [])
        : (byFolio.get(folio) ?? []);
      if (ids.length === 0) {
        result.unmatched.push({
          file: name,
          reason: `Sin documento para el folio ${folio}${klass ? ` (${klass})` : ""}.`,
        });
        continue;
      }
      if (ids.length > 1) {
        result.unmatched.push({
          file: name,
          reason: `Folio ${folio} coincide con varios documentos.`,
        });
        continue;
      }

      const id = ids[0];
      const buf = Buffer.from(await file.arrayBuffer());
      const path = `${id}/${ext}.${ext}`;
      await uploadToStorage(
        INVOICES_BUCKET,
        path,
        buf,
        ext === "pdf" ? "application/pdf" : "application/xml",
      );
      const u = updates.get(id) ?? {};
      u[ext] = path;

      // XML: extrae el detalle del DTE de este folio y sugiere clasificación.
      if (ext === "xml") {
        try {
          const parsed = parseDte(decodeXml(buf));
          const dte =
            parsed.find((p) => p.folio.replace(/^0+(?=\d)/, "") === folio) ??
            parsed[0];
          if (dte?.lines.length) {
            u.lines = dte.lines;
            const area = detectArea(dte.lines);
            u.businessLineId = area ? (blByArea.get(area) ?? null) : null;
            u.serviceId = matchService(dte.lines, area as Area | null, svcRows);
          }
        } catch (err) {
          console.error("[bulkUploadFiles:parseDte]", folio, err);
        }
      }

      updates.set(id, u);
      result.attached++;
      if (!result.matchedFolios.includes(folio)) result.matchedFolios.push(folio);
    }

    // Persiste paths, líneas del detalle y clasificación sugerida.
    for (const [id, u] of updates) {
      // Detalle del XML → fin_document_lines (reemplaza lo previo del documento).
      if (u.lines?.length) {
        await db.delete(finDocumentLines).where(eq(finDocumentLines.documentId, id));
        await db.insert(finDocumentLines).values(
          u.lines.map((l) => ({
            documentId: id,
            descripcion: [l.nombre, l.descripcion].filter(Boolean).join(" — ").slice(0, 2000),
            cantidad: String(l.cantidad),
            precio: String(l.precio ?? 0),
            monto: String(l.monto),
          })),
        );
        result.extracted++;
      }

      // Clasificación: solo se sugiere si el documento aún no la tiene (no pisa
      // lo que el usuario haya clasificado a mano).
      const [current] = u.lines?.length
        ? await db
            .select({
              businessLineId: finDocuments.businessLineId,
              serviceId: finDocuments.serviceId,
            })
            .from(finDocuments)
            .where(eq(finDocuments.id, id))
            .limit(1)
        : [undefined];

      await db
        .update(finDocuments)
        .set({
          ...(u.pdf ? { pdfPath: u.pdf } : {}),
          ...(u.xml ? { xmlPath: u.xml } : {}),
          ...(current && !current.businessLineId && u.businessLineId
            ? { businessLineId: u.businessLineId }
            : {}),
          ...(current && !current.serviceId && u.serviceId
            ? { serviceId: u.serviceId }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(finDocuments.id, id));
    }

    await logActivity({
      entityType: "fin_document",
      action: `bulk_files:${direction}:${result.attached}`,
      actorId: user.id,
    });

    revalidatePath("/finanzas/ingresos");
    revalidatePath("/finanzas/egresos");
    return { ok: true, data: result };
  } catch (err) {
    return handleActionError(err, "bulkUploadFiles");
  }
}
