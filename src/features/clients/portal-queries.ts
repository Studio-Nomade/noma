import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  paymentReports,
  projects,
  retainerPeriods,
  retainers,
  salesOrders,
} from "@/db/schema";
import { getClientAccount, type ClientAccount } from "./invoices-queries";
import type { Area } from "@/types/enums";
import { monthlyPeriodBounds } from "@/features/retainers/periods";

/**
 * Datos del portal del cliente (acceso por token, sin sesión).
 *
 * Esta consulta es la frontera de privacidad: la ve gente ajena al estudio, así
 * que selecciona SOLO campos seguros. Nunca notas internas, presupuestos, etapa
 * comercial ni próxima acción — son información del estudio, no del cliente.
 */

export type PortalProject = {
  id: string;
  name: string;
  area: Area;
  status: string;
  startDate: string | null;
  deliveryDate: string | null;
};

export type PortalData = {
  clientId: string;
  clientName: string;
  account: ClientAccount;
  projects: PortalProject[];
  salesOrders: {
    id: string;
    folio: string;
    status: string;
    emissionDate: string;
    totalAmount: string;
    currency: "UF" | "CLP" | "USD";
  }[];
  reportedDocumentIds: string[];
  reportedSalesOrderIds: string[];
  retainers: {
    id: string;
    projectName: string;
    unit: string;
    quota: string;
    consumed: string;
    remaining: string;
    periodStart: string;
    periodEnd: string;
  }[];
};

export async function getPortalData(token: string): Promise<PortalData | null> {
  const clean = token.trim();
  if (!clean) return null;

  const [client] = await db
    .select({ id: clients.id, companyName: clients.companyName })
    .from(clients)
    .where(eq(clients.portalToken, clean))
    .limit(1);
  if (!client) return null;

  const bounds = monthlyPeriodBounds(new Date());
  const [account, rows, orders, reports, retainerRows] = await Promise.all([
    getClientAccount(client.id),
    db
      .select({
        id: projects.id,
        name: projects.name,
        area: projects.area,
        status: projects.status,
        startDate: projects.startDate,
        deliveryDate: projects.deliveryDate,
      })
      .from(projects)
      .where(eq(projects.clientId, client.id))
      .orderBy(desc(projects.updatedAt)),
    db
      .select({
        id: salesOrders.id,
        folio: salesOrders.folio,
        status: salesOrders.status,
        emissionDate: salesOrders.emissionDate,
        totalAmount: salesOrders.totalAmount,
        currency: salesOrders.currency,
      })
      .from(salesOrders)
      .where(eq(salesOrders.clientId, client.id))
      .orderBy(desc(salesOrders.emissionDate)),
    db
      .select({
        documentId: paymentReports.documentId,
        salesOrderId: paymentReports.salesOrderId,
      })
      .from(paymentReports)
      .where(eq(paymentReports.clientId, client.id)),
    db
      .select({
        id: retainers.id,
        projectName: projects.name,
        unit: retainers.unit,
        quota: retainerPeriods.quota,
        consumed: retainerPeriods.consumed,
        remaining: retainerPeriods.remaining,
        periodStart: retainerPeriods.periodStart,
        periodEnd: retainerPeriods.periodEnd,
      })
      .from(retainers)
      .innerJoin(projects, eq(retainers.projectId, projects.id))
      .innerJoin(
        retainerPeriods,
        and(
          eq(retainerPeriods.retainerId, retainers.id),
          eq(retainerPeriods.periodStart, bounds.start),
        ),
      )
      .where(
        and(
          eq(retainers.clientId, client.id),
          eq(retainers.status, "active"),
        ),
      )
      .orderBy(projects.name),
  ]);

  return {
    clientId: client.id,
    clientName: client.companyName,
    account,
    projects: rows,
    salesOrders: orders,
    reportedDocumentIds: reports.flatMap((row) =>
      row.documentId ? [row.documentId] : [],
    ),
    reportedSalesOrderIds: reports.flatMap((row) =>
      row.salesOrderId ? [row.salesOrderId] : [],
    ),
    retainers: retainerRows,
  };
}
