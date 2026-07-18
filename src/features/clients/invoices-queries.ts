import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { finDocuments, finContacts, clients } from "@/db/schema";
import { normalizeRut, isRealRut } from "@/lib/text/rut";
import { INVOICES_BUCKET, signedUrls } from "@/lib/supabase/storage";

/**
 * Historial de facturas de un cliente (estado de cuenta).
 *
 * Los documentos tributarios viven en Finanzas (`fin_documents`) y se cruzan con
 * la ficha comercial vía `fin_contacts.client_id`, que se rellena por RUT al
 * importar. Como respaldo, también se cruza por RUT en vivo: así un cliente
 * cuyo contacto todavía no quedó vinculado igual ve sus facturas.
 */

export type ClientInvoice = {
  id: string;
  folio: string | null;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  total: string;
  saldo: number;
  status: string;
  /** Días de atraso (+) o los que faltan para vencer (−). null si no aplica. */
  diasVencida: number | null;
  pdfUrl: string | null;
  xmlUrl: string | null;
};

export type ClientAccount = {
  invoices: ClientInvoice[];
  totalPendiente: number;
  totalFacturado: number;
  vencidas: number;
  /** Promedio de días entre emisión y pago de las facturas saldadas. */
  diasPagoPromedio: number | null;
};

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export async function getClientAccount(clientId: string): Promise<ClientAccount> {
  const [client] = await db
    .select({ rut: clients.rut })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  // Vínculo directo, o cruce por RUT si el contacto aún no está vinculado.
  const rut = isRealRut(client?.rut) ? normalizeRut(client!.rut) : null;
  const matchesClient = rut
    ? sql`(${finContacts.clientId} = ${clientId} or upper(replace(replace(${finContacts.rut}, '.', ''), ' ', '')) = ${rut})`
    : eq(finContacts.clientId, clientId);

  const rows = await db
    .select({
      id: finDocuments.id,
      folio: finDocuments.folio,
      fechaEmision: finDocuments.fechaEmision,
      fechaVencimiento: finDocuments.fechaVencimiento,
      total: finDocuments.total,
      conciliado: finDocuments.montoConciliado,
      status: finDocuments.status,
      updatedAt: finDocuments.updatedAt,
      pdfPath: finDocuments.pdfPath,
      xmlPath: finDocuments.xmlPath,
    })
    .from(finDocuments)
    .innerJoin(finContacts, eq(finDocuments.contactId, finContacts.id))
    .where(and(eq(finDocuments.direction, "VENTA"), matchesClient))
    .orderBy(desc(finDocuments.fechaEmision));

  // Enlaces firmados (bucket privado) para los archivos que existan, en lote.
  // Si Storage no responde, quedan sin enlace y los botones se muestran inactivos.
  const paths = rows.flatMap((r) =>
    [r.pdfPath, r.xmlPath].filter((p): p is string => !!p),
  );
  const urls = paths.length
    ? await signedUrls(INVOICES_BUCKET, paths).catch(() => new Map())
    : new Map<string, string>();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalPendiente = 0;
  let totalFacturado = 0;
  let vencidas = 0;
  const plazos: number[] = [];

  const invoices: ClientInvoice[] = rows.map((r) => {
    const total = Number(r.total ?? 0);
    const saldo = Math.max(total - Number(r.conciliado ?? 0), 0);
    totalFacturado += total;
    totalPendiente += saldo;

    let diasVencida: number | null = null;
    if (saldo > 0 && r.fechaVencimiento) {
      diasVencida = daysBetween(new Date(r.fechaVencimiento), today);
      if (diasVencida > 0) vencidas++;
    }
    // Saldada: aproxima el plazo de pago con la última actualización del doc
    // (Finanzas no guarda fecha de pago; la conciliación es lo más cercano).
    if (saldo === 0 && r.fechaEmision && r.updatedAt) {
      const d = daysBetween(new Date(r.fechaEmision), new Date(r.updatedAt));
      if (d >= 0) plazos.push(d);
    }

    return {
      id: r.id,
      folio: r.folio,
      fechaEmision: r.fechaEmision,
      fechaVencimiento: r.fechaVencimiento,
      total: r.total ?? "0",
      saldo,
      status: r.status,
      diasVencida,
      pdfUrl: r.pdfPath ? (urls.get(r.pdfPath) ?? null) : null,
      xmlUrl: r.xmlPath ? (urls.get(r.xmlPath) ?? null) : null,
    };
  });

  return {
    invoices,
    totalPendiente,
    totalFacturado,
    vencidas,
    diasPagoPromedio: plazos.length
      ? Math.round(plazos.reduce((a, b) => a + b, 0) / plazos.length)
      : null,
  };
}
