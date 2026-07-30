import { and, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  businessLines,
  finContacts,
  finDocuments,
  ledgerAccounts,
  salesOrderBillingItems,
  salesOrders,
  services,
} from "@/db/schema";
import { IVA_RATE } from "@/features/proposals/totals";
import { toNum } from "./helpers";

export type ProfitLossGrouping = "account" | "client" | "line";
export type ProfitLossSection = "income" | "cost" | "expense" | "unclassified";

export interface ProfitLossRow {
  key: string;
  label: string;
  detail?: string;
  section: ProfitLossSection;
  months: Record<string, number>;
  total: number;
  proforma: number;
}

export interface ProfitLossReport {
  months: string[];
  currentMonth: string;
  rows: ProfitLossRow[];
  totals: Record<
    ProfitLossSection | "grossMargin" | "operatingResult",
    { months: Record<string, number>; total: number; proforma: number }
  >;
}

function monthRange(from: string, to: string) {
  const months: string[] = [];
  const cursor = new Date(`${from}-01T12:00:00Z`);
  const end = new Date(`${to}-01T12:00:00Z`);
  while (cursor <= end && months.length < 36) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function emptyMonthly(months: string[]) {
  return Object.fromEntries(months.map((month) => [month, 0]));
}

function sectionFor(
  direction: "VENTA" | "COMPRA",
  accountType: string | null,
): ProfitLossSection {
  if (direction === "VENTA") return "income";
  if (accountType === "COSTO") return "cost";
  if (accountType === "GASTO") return "expense";
  return "unclassified";
}

/**
 * Estado de Resultados devengado. Los documentos contables son la fuente del
 * real; las cuotas pendientes de NV solo complementan la proforma y nunca se
 * contabilizan dos veces.
 */
export async function getMonthlyProfitAndLoss({
  from,
  to,
  grouping,
  includeUnbilled,
}: {
  from: string;
  to: string;
  grouping: ProfitLossGrouping;
  includeUnbilled: boolean;
}): Promise<ProfitLossReport> {
  const months = monthRange(from, to);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const documents = await db
    .select({
      direction: finDocuments.direction,
      type: finDocuments.type,
      net: finDocuments.neto,
      period: finDocuments.periodoSii,
      issueDate: finDocuments.fechaEmision,
      accountId: ledgerAccounts.id,
      accountCode: ledgerAccounts.code,
      accountName: ledgerAccounts.name,
      accountType: ledgerAccounts.type,
      area: ledgerAccounts.area,
      serviceName: services.name,
      contactId: finContacts.id,
      contactName: finContacts.name,
      lineId: businessLines.id,
      lineName: businessLines.name,
    })
    .from(finDocuments)
    .leftJoin(
      ledgerAccounts,
      eq(finDocuments.ledgerAccountId, ledgerAccounts.id),
    )
    .leftJoin(services, eq(finDocuments.serviceId, services.id))
    .leftJoin(finContacts, eq(finDocuments.contactId, finContacts.id))
    .leftJoin(
      businessLines,
      eq(finDocuments.businessLineId, businessLines.id),
    )
    .where(
      and(
        eq(finDocuments.recordStatus, "ACTIVO"),
        gte(finDocuments.fechaEmision, `${from}-01`),
        lte(finDocuments.fechaEmision, `${to}-31`),
      ),
    );

  const rowMap = new Map<string, ProfitLossRow>();
  const add = ({
    key,
    label,
    detail,
    section,
    month,
    amount,
    proformaOnly = false,
  }: {
    key: string;
    label: string;
    detail?: string;
    section: ProfitLossSection;
    month: string;
    amount: number;
    proformaOnly?: boolean;
  }) => {
    const mapKey = `${section}:${key}`;
    const row = rowMap.get(mapKey) ?? {
      key: mapKey,
      label,
      detail,
      section,
      months: emptyMonthly(months),
      total: 0,
      proforma: 0,
    };
    if (!proformaOnly && month in row.months) {
      row.months[month] += amount;
      row.total += amount;
    }
    if (month === currentMonth) row.proforma += amount;
    rowMap.set(mapKey, row);
  };

  for (const document of documents) {
    const month = document.period ?? document.issueDate.slice(0, 7);
    const section = sectionFor(document.direction, document.accountType);
    // Las NOTA_CREDITO reducen ventas o compras dentro de su sección. Firmamos
    // por TIPO (no por el signo almacenado) para ser robustos ante cualquier vía
    // de ingreso: el importador ya las normaliza a negativo, y así una NC creada
    // por otra vía con neto positivo también resta.
    const amount =
      (document.type === "NOTA_CREDITO" ? -1 : 1) *
      Math.abs(toNum(document.net));
    if (grouping === "client") {
      add({
        key: document.contactId ?? "no-client",
        label: document.contactName ?? "Sin contacto",
        section,
        month,
        amount,
      });
    } else if (grouping === "line") {
      add({
        key: document.lineId ?? "no-line",
        label: document.lineName ?? "Sin línea de negocio",
        section,
        month,
        amount,
      });
    } else {
      add({
        key: document.accountId ?? "no-account",
        label: document.serviceName ?? document.accountName ?? "Sin clasificar",
        detail: [
          document.accountCode,
          document.area,
          document.serviceName ? document.accountName : null,
        ]
          .filter(Boolean)
          .join(" · "),
        section,
        month,
        amount,
      });
    }
  }

  if (includeUnbilled) {
    const pending = await db
      .select({
        id: salesOrderBillingItems.id,
        date: salesOrderBillingItems.tentativeDate,
        amount: salesOrderBillingItems.calculatedAmount,
        label: salesOrderBillingItems.label,
        orderId: salesOrders.id,
      })
      .from(salesOrderBillingItems)
      .innerJoin(
        salesOrders,
        eq(salesOrderBillingItems.salesOrderId, salesOrders.id),
      )
      .where(
        and(
          eq(salesOrderBillingItems.status, "PENDIENTE"),
          ne(salesOrders.status, "BORRADOR"),
          gte(salesOrderBillingItems.tentativeDate, `${from}-01`),
          lte(salesOrderBillingItems.tentativeDate, `${to}-31`),
        ),
      );
    for (const item of pending) {
      if (!item.date) continue;
      // calculatedAmount queda congelado en CLP bruto. El P&L es neto, por eso
      // descontamos el IVA uniforme de 19%; un ítem exento requerirá modelado
      // tributario explícito antes de poder evitar este descuento.
      add({
        key: `unbilled:${item.orderId}`,
        label: "Ingresos por facturar",
        detail: item.label,
        section: "income",
        month: item.date.slice(0, 7),
        amount: toNum(item.amount) / (1 + IVA_RATE),
        proformaOnly: true,
      });
    }
  }

  const rows = Array.from(rowMap.values()).sort(
    (a, b) =>
      a.section.localeCompare(b.section) || a.label.localeCompare(b.label),
  );
  const sections: ProfitLossSection[] = [
    "income",
    "cost",
    "expense",
    "unclassified",
  ];
  const aggregate = (filter: (row: ProfitLossRow) => boolean) => {
    const selected = rows.filter(filter);
    return {
      months: Object.fromEntries(
        months.map((month) => [
          month,
          selected.reduce((sum, row) => sum + row.months[month], 0),
        ]),
      ),
      total: selected.reduce((sum, row) => sum + row.total, 0),
      proforma: selected.reduce((sum, row) => sum + row.proforma, 0),
    };
  };
  const totals = Object.fromEntries(
    sections.map((section) => [
      section,
      aggregate((row) => row.section === section),
    ]),
  ) as ProfitLossReport["totals"];
  const combine = (
    left: (typeof totals)["income"],
    subtract: (typeof totals)["income"][],
  ) => ({
    months: Object.fromEntries(
      months.map((month) => [
        month,
        left.months[month] -
          subtract.reduce((sum, item) => sum + item.months[month], 0),
      ]),
    ),
    total:
      left.total - subtract.reduce((sum, item) => sum + item.total, 0),
    proforma:
      left.proforma - subtract.reduce((sum, item) => sum + item.proforma, 0),
  });
  totals.grossMargin = combine(totals.income, [totals.cost]);
  totals.operatingResult = combine(totals.income, [
    totals.cost,
    totals.expense,
    totals.unclassified,
  ]);

  return { months, currentMonth, rows, totals };
}
