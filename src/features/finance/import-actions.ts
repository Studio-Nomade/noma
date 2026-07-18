"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and, inArray, sql, asc, count } from "drizzle-orm";
import { db } from "@/db";
import {
  importBatches,
  importTemplates,
  bankTransactions,
  bankAccounts,
  finDocuments,
  finContacts,
  classificationRules,
  clients,
} from "@/db/schema";
import { requireFinance } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type {
  ImportType,
  DocumentDirection,
  FinDocumentStatus,
  ContactType,
} from "@/types/enums";
import { normalizeRut, isRealRut } from "@/lib/text/rut";
import { parseFile } from "./import/parse";
import { mapDocuments, mapTransactions } from "./import/mappers";
import { classify } from "./import/classify";
import { periodoSii, money, toDateOnly } from "./helpers";
import type {
  ImportPreview,
  ImportSummary,
  ParsedTransaction,
} from "./import/types";

const DEFAULT_MAPPINGS: Record<ImportType, Record<string, string>> = {
  NUBOX_VENTAS: {
    tipoDoc: "Tipo Doc",
    folio: "Folio",
    rutContacto: "RUT cliente",
    nombreContacto: "Razon Social",
    fechaEmision: "Fecha Docto",
    fechaVencimiento: "Fecha Vencimiento",
    exento: "Monto Exento",
    neto: "Monto Neto",
    iva: "Monto IVA",
    total: "Monto Total",
  },
  NUBOX_COMPRAS: {
    tipoDoc: "Tipo Doc",
    folio: "Folio",
    rutContacto: "RUT Proveedor",
    nombreContacto: "Razon Social",
    fechaEmision: "Fecha Docto",
    fechaVencimiento: "Fecha Vencimiento",
    exento: "Monto Exento",
    neto: "Monto Neto",
    iva: "Monto IVA Recuperable",
    total: "Monto Total",
  },
  CARTOLA_BANCARIA: {
    fecha: "Fecha",
    glosa: "Descripción",
    cargo: "Cargo",
    abono: "Abono",
    saldo: "Saldo",
  },
};

const IMPORT_CHUNK_SIZE = 100;

function chunksOf<T>(items: T[], size = IMPORT_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildSummary(
  rowsDetected: number,
  rejected: number,
  duplicates: number,
  fechas: string[],
  totals: { neto: number; iva: number; bruto: number },
  warnings: string[],
): ImportSummary {
  const sorted = [...fechas].sort();
  return {
    rowsDetected,
    rowsValid: rowsDetected - rejected,
    rowsRejected: rejected,
    duplicates,
    totalNeto: totals.neto,
    totalIva: totals.iva,
    totalBruto: totals.bruto,
    fechaMin: sorted[0]?.slice(0, 10) ?? null,
    fechaMax: sorted[sorted.length - 1]?.slice(0, 10) ?? null,
    warnings,
  };
}

/** Crea un borrador de importación (dry-run) y redirige a la vista previa. */
export async function createImportDraft(formData: FormData): Promise<void> {
  const user = await requireFinance();

  const type = formData.get("type") as ImportType;
  const templateId = (formData.get("templateId") as string) || "";
  const bankAccountId = (formData.get("bankAccountId") as string) || "";
  const file = formData.get("file") as File | null;

  if (!type || !file || file.size === 0) {
    throw new Error("Falta el archivo o el tipo de importación.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows } = await parseFile(buffer, file.name);

  // Mapeo: plantilla seleccionada o el default del tipo
  let mapping = DEFAULT_MAPPINGS[type];
  if (templateId) {
    const [tpl] = await db
      .select()
      .from(importTemplates)
      .where(eq(importTemplates.id, templateId))
      .limit(1);
    if (tpl) mapping = tpl.columnMapping as Record<string, string>;
  }

  let preview: ImportPreview;

  if (type === "CARTOLA_BANCARIA") {
    if (!bankAccountId) {
      throw new Error("Selecciona la cuenta bancaria de destino.");
    }
    const { valid, rejected, warnings } = mapTransactions(rows, mapping);

    // Dedup contra la BD (misma cuenta, fecha, monto, glosa)
    const existing = await db
      .select({
        fecha: bankTransactions.fecha,
        monto: bankTransactions.monto,
        glosa: bankTransactions.glosa,
        tipo: bankTransactions.tipo,
      })
      .from(bankTransactions)
      .where(eq(bankTransactions.bankAccountId, bankAccountId));
    const existingKeys = new Set(
      existing.map(
        (t) =>
          `${t.fecha.slice(0, 10)}|${t.tipo}|${Math.round(Number(t.monto))}|${t.glosa}`,
      ),
    );
    let dupes = 0;
    for (const t of valid) {
      const key = `${t.fecha.slice(0, 10)}|${t.tipo}|${t.monto}|${t.glosa}`;
      if (t.isDuplicate || existingKeys.has(key)) {
        t.isDuplicate = true;
        dupes++;
      }
    }

    const summary = buildSummary(
      rows.length,
      rejected.length,
      dupes,
      valid.map((v) => v.fecha),
      {
        neto: 0,
        iva: 0,
        bruto: valid.reduce(
          (a, v) => a + (v.tipo === "ABONO" ? v.monto : -v.monto),
          0,
        ),
      },
      warnings,
    );
    preview = { type, bankAccountId, transactions: valid, rejected, summary };
  } else {
    const direction: DocumentDirection =
      type === "NUBOX_VENTAS" ? "VENTA" : "COMPRA";
    const { valid, rejected, warnings } = mapDocuments(rows, mapping, direction);

    // Dedup contra la BD (dirección, tipo, folio, rut del contacto)
    const folios = valid.map((v) => v.folio);
    const existing = folios.length
      ? await db
          .select({
            type: finDocuments.type,
            folio: finDocuments.folio,
            rut: finContacts.rut,
          })
          .from(finDocuments)
          .leftJoin(finContacts, eq(finDocuments.contactId, finContacts.id))
          .where(
            and(
              eq(finDocuments.direction, direction),
              inArray(finDocuments.folio, folios),
            ),
          )
      : [];
    const existingKeys = new Set(
      existing.map((d) => `${d.type}|${d.folio}|${d.rut ?? ""}`),
    );
    let dupes = 0;
    for (const d of valid) {
      const key = `${d.type}|${d.folio}|${d.rut}`;
      if (d.isDuplicate || existingKeys.has(key)) {
        d.isDuplicate = true;
        dupes++;
      }
    }

    const summary = buildSummary(
      rows.length,
      rejected.length,
      dupes,
      valid.map((v) => v.fechaEmision),
      {
        neto: valid.reduce((a, v) => a + v.neto, 0),
        iva: valid.reduce((a, v) => a + v.iva, 0),
        bruto: valid.reduce((a, v) => a + v.total, 0),
      },
      warnings,
    );
    preview = { type, documents: valid, rejected, summary };
  }

  // Nota: el archivo original NO se guarda en storage en esta fase (storagePath null).
  const [batch] = await db
    .insert(importBatches)
    .values({
      type,
      status: "BORRADOR",
      fileName: file.name,
      storagePath: null,
      rowsDetected: preview.summary.rowsDetected,
      rowsValid: preview.summary.rowsValid,
      rowsRejected: preview.summary.rowsRejected,
      totalNeto: money(preview.summary.totalNeto),
      totalIva: money(preview.summary.totalIva),
      totalBruto: money(preview.summary.totalBruto),
      summary: preview as unknown as Record<string, unknown>,
      createdBy: user.id,
    })
    .returning({ id: importBatches.id });

  await logActivity({
    entityType: "import_batch",
    entityId: batch.id,
    action: "import_created",
    actorId: user.id,
  });

  redirect(`/finanzas/importar/${batch.id}`);
}

/** Confirma la importación: inserta documentos o movimientos en la BD. */
export async function confirmImport(formData: FormData): Promise<void> {
  const user = await requireFinance();
  const batchId = formData.get("batchId") as string;
  const result = await db.transaction(async (tx) => {
    // Serializa confirmaciones del mismo lote. Un doble click o reintento del
    // navegador espera este lock y luego ve el lote ya confirmado.
    const [batch] = await tx
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, batchId))
      .limit(1)
      .for("update");
    if (!batch || batch.status !== "BORRADOR") {
      throw new Error("La importación no existe o ya fue procesada.");
    }

    const preview = batch.summary as unknown as ImportPreview;
    let inserted = 0;
    let activityAction = "documents_imported";

    if (batch.type === "CARTOLA_BANCARIA" && preview.transactions) {
      activityAction = "bank_transactions_imported";
      const bankAccountId = preview.bankAccountId!;
      const toInsert = preview.transactions.filter((t) => !t.isDuplicate);
      for (const chunk of chunksOf(toInsert)) {
        await tx.insert(bankTransactions).values(
          chunk.map((t: ParsedTransaction) => ({
            bankAccountId,
            fecha: toDateOnly(t.fecha),
            glosa: t.glosa,
            monto: money(t.monto),
            tipo: t.tipo,
            saldo: t.saldo !== null ? money(t.saldo) : null,
            status: "PENDIENTE" as const,
            recordStatus: "ACTIVO" as const,
            importBatchId: batch.id,
            sourceFile: batch.fileName,
          })),
        );
        inserted += chunk.length;
      }

      const last = [...toInsert]
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .pop();
      if (last?.saldo !== null && last?.saldo !== undefined) {
        await tx
          .update(bankAccounts)
          .set({ saldo: money(last.saldo) })
          .where(eq(bankAccounts.id, bankAccountId));
      }
    } else if (preview.documents) {
      const direction: DocumentDirection =
        batch.type === "NUBOX_VENTAS" ? "VENTA" : "COMPRA";
      const contactType: ContactType =
        direction === "VENTA" ? "CLIENTE" : "PROVEEDOR";
      const docs = preview.documents.filter((d) => !d.isDuplicate);
      const rules = await tx
        .select()
        .from(classificationRules)
        .where(eq(classificationRules.isActive, true))
        .orderBy(asc(classificationRules.priority));
      const today = new Date();
      const clientRows = await tx
        .select({ id: clients.id, rut: clients.rut })
        .from(clients);
      const clientByRut = new Map<string, string>();
      for (const client of clientRows) {
        if (isRealRut(client.rut)) {
          clientByRut.set(normalizeRut(client.rut)!, client.id);
        }
      }

      const uniqueContacts = new Map<string, (typeof docs)[number]>();
      for (const document of docs) {
        uniqueContacts.set(document.rut || "SIN-RUT", document);
      }
      const contacts = [...uniqueContacts.entries()].map(([rut, document]) => ({
        rut,
        name: document.nombre,
        type: contactType,
        status: "ACTIVO" as const,
        clientId: isRealRut(rut)
          ? (clientByRut.get(normalizeRut(rut)!) ?? null)
          : null,
      }));

      for (const chunk of chunksOf(contacts)) {
        await tx
          .insert(finContacts)
          .values(chunk)
          .onConflictDoUpdate({
            target: [finContacts.rut, finContacts.type],
            set: {
              name: sql`excluded.name`,
              clientId: sql`coalesce(excluded.client_id, ${finContacts.clientId})`,
            },
          });
      }

      const contactMap = new Map<string, string>();
      for (const rutChunk of chunksOf(contacts.map((contact) => contact.rut))) {
        const resolved = await tx
          .select({ id: finContacts.id, rut: finContacts.rut })
          .from(finContacts)
          .where(
            and(
              eq(finContacts.type, contactType),
              inArray(finContacts.rut, rutChunk),
            ),
          );
        for (const contact of resolved) contactMap.set(contact.rut, contact.id);
      }

      const values = docs.map((document) => {
        const rut = document.rut || "SIN-RUT";
        const cls = classify(rules, {
          rut: document.rut,
          nombre: document.nombre,
          total: document.total,
        });
        const venc = document.fechaVencimiento;
        const status: FinDocumentStatus =
          venc && new Date(venc) < today ? "VENCIDA" : "EMITIDA";
        return {
          direction,
          type: document.type,
          folio: document.folio,
          contactId: contactMap.get(rut),
          fechaEmision: toDateOnly(document.fechaEmision),
          fechaVencimiento: venc ? toDateOnly(venc) : null,
          neto: money(document.neto),
          iva: money(document.iva),
          exento: money(document.exento),
          total: money(document.total),
          status,
          recordStatus: "ACTIVO" as const,
          periodoSii: periodoSii(document.fechaEmision),
          ledgerAccountId: cls.ledgerAccountId,
          costCenterId: cls.costCenterId,
          businessLineId: cls.businessLineId,
          importBatchId: batch.id,
          sourceFile: batch.fileName,
        };
      });

      for (const chunk of chunksOf(values)) {
        const rows = await tx
          .insert(finDocuments)
          .values(chunk)
          .onConflictDoNothing()
          .returning({ id: finDocuments.id });
        inserted += rows.length;
      }
    }

    const [batchTotal] =
      batch.type === "CARTOLA_BANCARIA"
        ? await tx
            .select({ value: count() })
            .from(bankTransactions)
            .where(eq(bankTransactions.importBatchId, batch.id))
        : await tx
            .select({ value: count() })
            .from(finDocuments)
            .where(eq(finDocuments.importBatchId, batch.id));
    inserted = batchTotal?.value ?? inserted;

    await tx
      .update(importBatches)
      .set({
        status: "CONFIRMADO",
        rowsInserted: inserted,
        confirmedAt: new Date(),
      })
      .where(eq(importBatches.id, batch.id));

    return { inserted, activityAction };
  });

  await logActivity({
    entityType: "import_batch",
    entityId: batchId,
    action: result.activityAction,
    actorId: user.id,
  });

  revalidatePath("/finanzas/importar");
  revalidatePath("/finanzas");
  redirect(`/finanzas/importar?confirmado=${result.inserted}`);
}

/** Rechaza (descarta) un borrador de importación. */
export async function rejectImport(formData: FormData): Promise<void> {
  const user = await requireFinance();
  const batchId = formData.get("batchId") as string;
  const [batch] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.id, batchId))
    .limit(1);
  if (batch && batch.status === "BORRADOR") {
    await db
      .update(importBatches)
      .set({ status: "RECHAZADO" })
      .where(eq(importBatches.id, batchId));
    await logActivity({
      entityType: "import_batch",
      entityId: batchId,
      action: "import_rejected",
      actorId: user.id,
    });
  }
  redirect("/finanzas/importar");
}
