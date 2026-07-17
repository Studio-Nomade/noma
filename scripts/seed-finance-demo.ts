/**
 * Datos de DEMO para el módulo CFO/Finanzas (solo para explorar en local).
 * Inserta contactos, documentos (ventas/compras) y movimientos bancarios de
 * ejemplo, algunos clasificados y otros no, y algunos que cuadran para probar
 * la conciliación. Idempotente: borra lo anterior (marcado 'DEMO') y recarga.
 *
 *   npx tsx scripts/seed-finance-demo.ts
 *
 * Para quitar la demo: vuelve a correr `npm run db:seed` no la borra; usa este
 * mismo script comentando la inserción, o borra filas con observacion/source 'DEMO'.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import {
  finContacts,
  finDocuments,
  bankAccounts,
  bankTransactions,
  ledgerAccounts,
  businessLines,
  reconciliationDocuments,
  reconciliationTransactions,
} from "@/db/schema";

const TAG = "DEMO";

async function ledger(code: string) {
  const [a] = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.code, code))
    .limit(1);
  return a?.id ?? null;
}
async function line(code: string) {
  const [l] = await db
    .select({ id: businessLines.id })
    .from(businessLines)
    .where(eq(businessLines.code, code))
    .limit(1);
  return l?.id ?? null;
}

async function cleanup() {
  const docs = await db
    .select({ id: finDocuments.id })
    .from(finDocuments)
    .where(eq(finDocuments.observacion, TAG));
  for (const d of docs) {
    await db
      .delete(reconciliationDocuments)
      .where(eq(reconciliationDocuments.documentId, d.id));
    await db.delete(finDocuments).where(eq(finDocuments.id, d.id));
  }
  const txns = await db
    .select({ id: bankTransactions.id })
    .from(bankTransactions)
    .where(eq(bankTransactions.sourceFile, TAG));
  for (const t of txns) {
    await db
      .delete(reconciliationTransactions)
      .where(eq(reconciliationTransactions.bankTransactionId, t.id));
    await db.delete(bankTransactions).where(eq(bankTransactions.id, t.id));
  }
  await db
    .delete(finContacts)
    .where(or(eq(finContacts.rut, "77111111-1"), eq(finContacts.rut, "78222222-2"), eq(finContacts.rut, "79333333-3"), eq(finContacts.rut, "80444444-4")));
}

function money(n: number) {
  return n.toFixed(2);
}

async function main() {
  await cleanup();

  const [acct] = await db.select().from(bankAccounts).limit(1);
  if (!acct) throw new Error("No hay cuenta bancaria. Corre 'npm run db:seed'.");

  const ventasAcc = await ledger("1.1"); // Ventas de servicios
  const arriendoAcc = await ledger("3.2"); // Servicios básicos y arriendo
  const bnd = await line("B&D");

  // ── Contactos ──
  const contacts = [
    { rut: "77111111-1", name: "Comercial Andes SpA", type: "CLIENTE" as const },
    { rut: "78222222-2", name: "Retail Sur Ltda", type: "CLIENTE" as const },
    { rut: "79333333-3", name: "Inmobiliaria Centro SpA", type: "PROVEEDOR" as const },
    { rut: "80444444-4", name: "Freelance Diseño EIRL", type: "PROVEEDOR" as const },
  ];
  const cid: Record<string, string> = {};
  for (const c of contacts) {
    const [row] = await db
      .insert(finContacts)
      .values({ ...c, status: "ACTIVO" })
      .onConflictDoUpdate({
        target: [finContacts.rut, finContacts.type],
        set: { name: c.name },
      })
      .returning({ id: finContacts.id });
    cid[c.rut] = row.id;
  }

  // ── Documentos (ventas + compras) ──
  const docs = [
    // ventas clasificadas
    { dir: "VENTA", type: "FACTURA_VENTA", folio: "2001", rut: "77111111-1", emis: "2026-05-10", venc: "2026-06-09", neto: 2000000, cls: ventasAcc, ln: bnd },
    { dir: "VENTA", type: "FACTURA_VENTA", folio: "2002", rut: "78222222-2", emis: "2026-06-05", venc: "2026-07-05", neto: 1500000, cls: ventasAcc, ln: bnd },
    // venta abierta que cuadra con un abono (para conciliación)
    { dir: "VENTA", type: "FACTURA_VENTA", folio: "2003", rut: "77111111-1", emis: "2026-06-20", venc: "2026-07-20", neto: 1000000, cls: ventasAcc, ln: bnd },
    // venta SIN clasificar (para bandeja)
    { dir: "VENTA", type: "FACTURA_VENTA", folio: "2004", rut: "78222222-2", emis: "2026-07-01", venc: "2026-07-31", neto: 800000, cls: null, ln: null },
    // compras
    { dir: "COMPRA", type: "FACTURA_COMPRA", folio: "550", rut: "79333333-3", emis: "2026-06-01", venc: "2026-06-30", neto: 700000, cls: arriendoAcc, ln: null },
    { dir: "COMPRA", type: "FACTURA_COMPRA", folio: "551", rut: "80444444-4", emis: "2026-06-15", venc: "2026-07-15", neto: 450000, cls: null, ln: null },
  ];

  for (const d of docs) {
    const iva = Math.round(d.neto * 0.19);
    const total = d.neto + iva;
    await db.insert(finDocuments).values({
      direction: d.dir as "VENTA" | "COMPRA",
      type: d.type as "FACTURA_VENTA" | "FACTURA_COMPRA",
      folio: d.folio,
      contactId: cid[d.rut],
      fechaEmision: d.emis,
      fechaVencimiento: d.venc,
      neto: money(d.neto),
      iva: money(iva),
      exento: money(0),
      total: money(total),
      status: "EMITIDA",
      recordStatus: "ACTIVO",
      periodoSii: d.emis.slice(0, 7),
      ledgerAccountId: d.cls,
      businessLineId: d.ln,
      sourceFile: TAG,
      observacion: TAG,
    });
  }

  // ── Movimientos bancarios ──
  // Un abono de 1.190.000 que cuadra con la factura 2003 (neto 1.000.000 + IVA).
  const txns = [
    { fecha: "2026-06-25", glosa: "Transferencia de Comercial Andes 77111111", monto: 1190000, tipo: "ABONO" as const },
    { fecha: "2026-06-30", glosa: "Pago arriendo Inmobiliaria Centro", monto: 833000, tipo: "CARGO" as const },
    { fecha: "2026-07-02", glosa: "Pago freelance diseño", monto: 200000, tipo: "CARGO" as const },
    { fecha: "2026-07-03", glosa: "Comisión mantención cuenta", monto: 8900, tipo: "CARGO" as const },
    { fecha: "2026-07-04", glosa: "Transferencia recibida cliente", monto: 500000, tipo: "ABONO" as const },
  ];
  for (const t of txns) {
    await db.insert(bankTransactions).values({
      bankAccountId: acct.id,
      fecha: t.fecha,
      glosa: t.glosa,
      monto: money(t.monto),
      tipo: t.tipo,
      status: "PENDIENTE",
      recordStatus: "ACTIVO",
      sourceFile: TAG,
    });
  }
  await db
    .update(bankAccounts)
    .set({ saldo: money(4500000) })
    .where(eq(bankAccounts.id, acct.id));

  console.log("✓ Demo CFO cargada:", docs.length, "documentos,", txns.length, "movimientos.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
