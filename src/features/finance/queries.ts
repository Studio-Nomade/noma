import {
  and,
  eq,
  ne,
  ilike,
  desc,
  asc,
  inArray,
  gte,
  lte,
  isNull,
  count,
} from "drizzle-orm";
import { db } from "@/db";
import {
  bankAccounts,
  bankTransactions,
  finDocuments,
  finContacts,
  ledgerAccounts,
  costCenters,
  businessLines,
  classificationRules,
} from "@/db/schema";
import type {
  DocumentDirection,
  FinDocumentStatus,
  LedgerAccountType,
} from "@/types/enums";
import { toNum } from "./helpers";

const OPEN_DOC: FinDocumentStatus[] = ["EMITIDA", "PARCIAL", "VENCIDA"];

// ── Banco ────────────────────────────────────────────────────

export async function getBankAccounts() {
  const rows = await db.select().from(bankAccounts).orderBy(bankAccounts.name);
  return rows.map((a) => ({ ...a, saldo: toNum(a.saldo) }));
}

export interface BankFilters {
  estado?: string;
  buscar?: string;
}

export async function getTransactions(
  bankAccountId: string,
  filters: BankFilters,
  pagination: { page: number; pageSize: number },
) {
  const conds = [
    eq(bankTransactions.bankAccountId, bankAccountId),
    ne(bankTransactions.recordStatus, "ELIMINADO_LOGICO"),
  ];
  if (filters.estado && filters.estado !== "TODOS") {
    conds.push(
      eq(
        bankTransactions.status,
        filters.estado as (typeof bankTransactions.status.enumValues)[number],
      ),
    );
  }
  if (filters.buscar) {
    conds.push(ilike(bankTransactions.glosa, `%${filters.buscar}%`));
  }
  const where = and(...conds);
  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(bankTransactions)
      .where(where)
      .orderBy(desc(bankTransactions.fecha))
      .limit(pagination.pageSize)
      .offset((pagination.page - 1) * pagination.pageSize),
    db.select({ value: count() }).from(bankTransactions).where(where),
  ]);
  return { rows, total: totalRows[0]?.value ?? 0 };
}

export async function getTransaction(txnId: string) {
  const [row] = await db
    .select()
    .from(bankTransactions)
    .where(eq(bankTransactions.id, txnId))
    .limit(1);
  return row ?? null;
}

type OpenDoc = {
  id: string;
  folio: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  total: string;
  montoConciliado: string;
  contactName: string | null;
  contactRut: string | null;
  saldo: number;
};

/** Documentos abiertos candidatos para conciliar contra un tipo de movimiento. */
export async function getOpenDocumentsFor(
  direction: DocumentDirection,
): Promise<OpenDoc[]> {
  const rows = await db
    .select({
      id: finDocuments.id,
      folio: finDocuments.folio,
      fechaEmision: finDocuments.fechaEmision,
      fechaVencimiento: finDocuments.fechaVencimiento,
      total: finDocuments.total,
      montoConciliado: finDocuments.montoConciliado,
      contactName: finContacts.name,
      contactRut: finContacts.rut,
    })
    .from(finDocuments)
    .leftJoin(finContacts, eq(finDocuments.contactId, finContacts.id))
    .where(
      and(
        eq(finDocuments.direction, direction),
        eq(finDocuments.recordStatus, "ACTIVO"),
        inArray(finDocuments.status, OPEN_DOC),
      ),
    )
    .orderBy(desc(finDocuments.fechaEmision));
  return rows.map((d) => ({
    ...d,
    saldo: toNum(d.total) - toNum(d.montoConciliado),
  }));
}

export interface Suggestion {
  txnId: string;
  fecha: string;
  glosa: string;
  tipo: "ABONO" | "CARGO";
  monto: number;
  docId: string;
  docFolio: string;
  docContacto: string;
  docSaldo: number;
  score: number;
}

/**
 * Sugerencias de conciliación: empareja movimientos pendientes con documentos
 * abiertos por monto exacto y cercanía de fecha / RUT en glosa.
 */
export async function getSuggestions(
  bankAccountId: string,
  limit = 20,
): Promise<Suggestion[]> {
  const txns = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.status, "PENDIENTE"),
        eq(bankTransactions.recordStatus, "ACTIVO"),
      ),
    )
    .orderBy(desc(bankTransactions.fecha))
    .limit(200);

  const [ventas, compras] = await Promise.all([
    getOpenDocumentsFor("VENTA"),
    getOpenDocumentsFor("COMPRA"),
  ]);

  const suggestions: Suggestion[] = [];

  for (const t of txns) {
    const monto = toNum(t.monto);
    const pool = t.tipo === "ABONO" ? ventas : compras;
    let best: OpenDoc | null = null;
    let bestScore = 0;

    for (const d of pool) {
      if (Math.round(d.saldo) !== Math.round(monto)) continue; // monto exacto
      let score = 60;
      const days = Math.abs(
        (new Date(t.fecha).getTime() - new Date(d.fechaEmision).getTime()) /
          86400000,
      );
      if (days <= 45) score += 20;
      const glosa = t.glosa.toLowerCase();
      const rutNum = (d.contactRut ?? "").split("-")[0];
      if (rutNum && glosa.includes(rutNum)) score += 20;
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }

    if (best) {
      suggestions.push({
        txnId: t.id,
        fecha: t.fecha,
        glosa: t.glosa,
        tipo: t.tipo,
        monto,
        docId: best.id,
        docFolio: best.folio,
        docContacto: best.contactName ?? "—",
        docSaldo: best.saldo,
        score: bestScore,
      });
    }
    if (suggestions.length >= limit) break;
  }

  return suggestions.sort((a, b) => b.score - a.score);
}

// ── Documentos (ingresos / egresos) ──────────────────────────

export async function getDocuments(
  direction: DocumentDirection,
  opts: { estado?: string; page?: number; pageSize?: number } = {},
) {
  const conds = [
    eq(finDocuments.direction, direction),
    ne(finDocuments.recordStatus, "ELIMINADO_LOGICO"),
  ];
  if (opts.estado && opts.estado !== "TODOS") {
    conds.push(
      eq(
        finDocuments.status,
        opts.estado as (typeof finDocuments.status.enumValues)[number],
      ),
    );
  }
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const where = and(...conds);
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: finDocuments.id,
        type: finDocuments.type,
        folio: finDocuments.folio,
        fechaEmision: finDocuments.fechaEmision,
        fechaVencimiento: finDocuments.fechaVencimiento,
        neto: finDocuments.neto,
        iva: finDocuments.iva,
        total: finDocuments.total,
        montoConciliado: finDocuments.montoConciliado,
        status: finDocuments.status,
        contactName: finContacts.name,
        contactRut: finContacts.rut,
        ledgerName: ledgerAccounts.name,
        pdfPath: finDocuments.pdfPath,
        xmlPath: finDocuments.xmlPath,
      })
      .from(finDocuments)
      .leftJoin(finContacts, eq(finDocuments.contactId, finContacts.id))
      .leftJoin(
        ledgerAccounts,
        eq(finDocuments.ledgerAccountId, ledgerAccounts.id),
      )
      .where(where)
      .orderBy(desc(finDocuments.fechaEmision))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(finDocuments).where(where),
  ]);
  return { rows, total: totalRows[0]?.value ?? 0 };
}

export type FinanceDocumentListItem = Awaited<
  ReturnType<typeof getDocuments>
>["rows"][number];

// ── Clasificación ────────────────────────────────────────────

/** Documentos activos sin cuenta contable asignada (bandeja "sin clasificar"). */
export async function getUnclassifiedDocuments() {
  return db
    .select({
      id: finDocuments.id,
      direction: finDocuments.direction,
      type: finDocuments.type,
      folio: finDocuments.folio,
      fechaEmision: finDocuments.fechaEmision,
      neto: finDocuments.neto,
      total: finDocuments.total,
      contactName: finContacts.name,
      contactRut: finContacts.rut,
    })
    .from(finDocuments)
    .leftJoin(finContacts, eq(finDocuments.contactId, finContacts.id))
    .where(
      and(
        isNull(finDocuments.ledgerAccountId),
        eq(finDocuments.recordStatus, "ACTIVO"),
        ne(finDocuments.status, "ANULADA"),
      ),
    )
    .orderBy(desc(finDocuments.fechaEmision))
    .limit(500);
}

/** Reglas de clasificación con los nombres de las dimensiones que asignan. */
export async function getClassificationRules() {
  return db
    .select({
      id: classificationRules.id,
      name: classificationRules.name,
      matchField: classificationRules.matchField,
      matchOperator: classificationRules.matchOperator,
      matchValue: classificationRules.matchValue,
      priority: classificationRules.priority,
      isActive: classificationRules.isActive,
      ledgerName: ledgerAccounts.name,
      lineName: businessLines.name,
      centerName: costCenters.name,
    })
    .from(classificationRules)
    .leftJoin(
      ledgerAccounts,
      eq(classificationRules.ledgerAccountId, ledgerAccounts.id),
    )
    .leftJoin(
      businessLines,
      eq(classificationRules.businessLineId, businessLines.id),
    )
    .leftJoin(costCenters, eq(classificationRules.costCenterId, costCenters.id))
    .orderBy(asc(classificationRules.priority));
}

/** Opciones para clasificar: cuentas contables, centros de costo, líneas. */
export async function getClassificationOptions() {
  const [ledgers, centers, lines] = await Promise.all([
    db
      .select({
        id: ledgerAccounts.id,
        code: ledgerAccounts.code,
        name: ledgerAccounts.name,
      })
      .from(ledgerAccounts)
      .where(eq(ledgerAccounts.status, "ACTIVO"))
      .orderBy(ledgerAccounts.code),
    db
      .select({
        id: costCenters.id,
        code: costCenters.code,
        name: costCenters.name,
      })
      .from(costCenters)
      .where(eq(costCenters.status, "ACTIVO"))
      .orderBy(costCenters.code),
    db
      .select({
        id: businessLines.id,
        code: businessLines.code,
        name: businessLines.name,
      })
      .from(businessLines)
      .where(eq(businessLines.status, "ACTIVO"))
      .orderBy(businessLines.code),
  ]);
  return { ledgers, centers, lines };
}

// ── Reportes ─────────────────────────────────────────────────

export interface PeriodRange {
  desde?: string; // YYYY-MM
  hasta?: string; // YYYY-MM
}

/** Resultado operacional: neto por cuenta contable (valores sin IVA). */
export async function getResultadoOperacional(range: PeriodRange = {}) {
  const conds = [eq(finDocuments.recordStatus, "ACTIVO")];
  if (range.desde) conds.push(gte(finDocuments.periodoSii, range.desde));
  if (range.hasta) conds.push(lte(finDocuments.periodoSii, range.hasta));

  const rows = await db
    .select({
      neto: finDocuments.neto,
      direction: finDocuments.direction,
      accId: ledgerAccounts.id,
      accCode: ledgerAccounts.code,
      accName: ledgerAccounts.name,
      accType: ledgerAccounts.type,
    })
    .from(finDocuments)
    .leftJoin(
      ledgerAccounts,
      eq(finDocuments.ledgerAccountId, ledgerAccounts.id),
    )
    .where(and(...conds));

  const map = new Map<
    string,
    {
      code: string;
      name: string;
      type: LedgerAccountType | "SIN";
      neto: number;
    }
  >();
  for (const d of rows) {
    const key = d.accId ?? "sin";
    const entry = map.get(key) ?? {
      code: d.accCode ?? "—",
      name: d.accName ?? "Sin clasificar",
      type: (d.accType ?? "SIN") as LedgerAccountType | "SIN",
      neto: 0,
    };
    const signed = d.direction === "VENTA" ? toNum(d.neto) : -toNum(d.neto);
    entry.neto += signed;
    map.set(key, entry);
  }

  const resultRows = Array.from(map.values()).sort((a, b) =>
    a.code.localeCompare(b.code),
  );
  const ingresos = resultRows
    .filter((r) => r.type === "INGRESO")
    .reduce((a, r) => a + r.neto, 0);
  const egresos = resultRows
    .filter((r) => r.type === "COSTO" || r.type === "GASTO")
    .reduce((a, r) => a + r.neto, 0);
  const resultado = resultRows.reduce((a, r) => a + r.neto, 0);

  return { rows: resultRows, ingresos, egresos: Math.abs(egresos), resultado };
}

/** Flujo de caja real (desde movimientos bancarios) por mes. */
export async function getFlujoCajaReal(months = 12) {
  const txns = await db
    .select({
      fecha: bankTransactions.fecha,
      monto: bankTransactions.monto,
      tipo: bankTransactions.tipo,
    })
    .from(bankTransactions)
    .where(eq(bankTransactions.recordStatus, "ACTIVO"));

  const map = new Map<string, { ingresos: number; egresos: number }>();
  for (const t of txns) {
    const key = t.fecha.slice(0, 7);
    const e = map.get(key) ?? { ingresos: 0, egresos: 0 };
    if (t.tipo === "ABONO") e.ingresos += toNum(t.monto);
    else e.egresos += toNum(t.monto);
    map.set(key, e);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-months)
    .map(([periodo, v]) => ({ periodo, ...v, neto: v.ingresos - v.egresos }));
}

/** Flujo de caja proyectado (por vencimiento de documentos abiertos). */
export async function getFlujoCajaProyectado() {
  const rows = await db
    .select({
      direction: finDocuments.direction,
      total: finDocuments.total,
      montoConciliado: finDocuments.montoConciliado,
      fechaVencimiento: finDocuments.fechaVencimiento,
    })
    .from(finDocuments)
    .where(
      and(
        eq(finDocuments.recordStatus, "ACTIVO"),
        inArray(finDocuments.status, OPEN_DOC),
      ),
    );

  const map = new Map<string, { porCobrar: number; porPagar: number }>();
  for (const d of rows) {
    if (!d.fechaVencimiento) continue;
    const key = d.fechaVencimiento.slice(0, 7);
    const saldo = toNum(d.total) - toNum(d.montoConciliado);
    const e = map.get(key) ?? { porCobrar: 0, porPagar: 0 };
    if (d.direction === "VENTA") e.porCobrar += saldo;
    else e.porPagar += saldo;
    map.set(key, e);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([periodo, v]) => ({ periodo, ...v, neto: v.porCobrar - v.porPagar }));
}

/** Ingresos por cliente / egresos por proveedor (neto). */
export async function getPorContacto(direction: DocumentDirection, limit = 20) {
  const rows = await db
    .select({
      neto: finDocuments.neto,
      name: finContacts.name,
      rut: finContacts.rut,
    })
    .from(finDocuments)
    .leftJoin(finContacts, eq(finDocuments.contactId, finContacts.id))
    .where(
      and(
        eq(finDocuments.direction, direction),
        eq(finDocuments.recordStatus, "ACTIVO"),
      ),
    );

  const map = new Map<
    string,
    { name: string; rut: string; neto: number; docs: number }
  >();
  for (const d of rows) {
    const name = d.name ?? "Sin contacto";
    const rut = d.rut ?? "";
    const e = map.get(name) ?? { name, rut, neto: 0, docs: 0 };
    e.neto += toNum(d.neto);
    e.docs += 1;
    map.set(name, e);
  }
  return Array.from(map.values())
    .sort((a, b) => b.neto - a.neto)
    .slice(0, limit);
}

/** Resultado por línea de negocio (ventas − compras, neto). */
export async function getResultadoPorLinea() {
  const rows = await db
    .select({
      neto: finDocuments.neto,
      direction: finDocuments.direction,
      linea: businessLines.name,
    })
    .from(finDocuments)
    .leftJoin(businessLines, eq(finDocuments.businessLineId, businessLines.id))
    .where(eq(finDocuments.recordStatus, "ACTIVO"));

  const map = new Map<
    string,
    { linea: string; ventas: number; compras: number }
  >();
  for (const d of rows) {
    const linea = d.linea ?? "Sin línea";
    const e = map.get(linea) ?? { linea, ventas: 0, compras: 0 };
    if (d.direction === "VENTA") e.ventas += toNum(d.neto);
    else e.compras += toNum(d.neto);
    map.set(linea, e);
  }
  return Array.from(map.values())
    .map((e) => ({ ...e, resultado: e.ventas - e.compras }))
    .sort((a, b) => b.resultado - a.resultado);
}

// ── Dashboard (KPIs) ─────────────────────────────────────────

export async function getDashboardKpis() {
  const [ventas, compras, cuentas, flujo] = await Promise.all([
    getOpenDocumentsFor("VENTA"),
    getOpenDocumentsFor("COMPRA"),
    getBankAccounts(),
    getFlujoCajaReal(12),
  ]);

  const porCobrar = ventas.reduce((a, d) => a + d.saldo, 0);
  const porPagar = compras.reduce((a, d) => a + d.saldo, 0);
  const saldoBanco = cuentas.reduce((a, c) => a + c.saldo, 0);

  const mesActual = new Date().toISOString().slice(0, 7);
  const mes = flujo.find((f) => f.periodo === mesActual);
  const resultadoMes = mes ? mes.neto : 0;

  return { porCobrar, porPagar, saldoBanco, resultadoMes, flujo };
}
