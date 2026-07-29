import "server-only";

import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  projects,
  proposals,
  salesOrderBillingItems,
  salesOrderLines,
  salesOrders,
} from "@/db/schema";

export async function listSalesOrders() {
  return db
    .select({
      order: salesOrders,
      clientName: clients.companyName,
      projectName: projects.name,
    })
    .from(salesOrders)
    .innerJoin(clients, eq(salesOrders.clientId, clients.id))
    .innerJoin(projects, eq(salesOrders.projectId, projects.id))
    .orderBy(desc(salesOrders.createdAt));
}

export async function getSalesOrder(id: string) {
  const [row] = await db
    .select({
      order: salesOrders,
      client: clients,
      projectName: projects.name,
      projectArea: projects.area,
      proposalTitle: proposals.title,
    })
    .from(salesOrders)
    .innerJoin(clients, eq(salesOrders.clientId, clients.id))
    .innerJoin(projects, eq(salesOrders.projectId, projects.id))
    .innerJoin(proposals, eq(salesOrders.proposalId, proposals.id))
    .where(eq(salesOrders.id, id))
    .limit(1);
  return row ?? null;
}

export async function getSalesOrderByProposal(proposalId: string) {
  const [row] = await db
    .select({ id: salesOrders.id })
    .from(salesOrders)
    .where(eq(salesOrders.proposalId, proposalId))
    .limit(1);
  return row ?? null;
}

export async function getSalesOrderLines(id: string) {
  return db
    .select()
    .from(salesOrderLines)
    .where(eq(salesOrderLines.salesOrderId, id))
    .orderBy(asc(salesOrderLines.position));
}

export async function getSalesOrderBillingItems(id: string) {
  return db
    .select()
    .from(salesOrderBillingItems)
    .where(eq(salesOrderBillingItems.salesOrderId, id))
    .orderBy(asc(salesOrderBillingItems.order));
}

export async function getSalesOrdersForProject(projectId: string) {
  return db
    .select()
    .from(salesOrders)
    .where(eq(salesOrders.projectId, projectId))
    .orderBy(desc(salesOrders.createdAt));
}

export async function getSalesOrderBillingItemsForProject(projectId: string) {
  return db
    .select({
      orderId: salesOrders.id,
      orderFolio: salesOrders.folio,
      orderCurrency: salesOrders.currency,
      item: salesOrderBillingItems,
    })
    .from(salesOrderBillingItems)
    .innerJoin(
      salesOrders,
      eq(salesOrderBillingItems.salesOrderId, salesOrders.id),
    )
    .where(eq(salesOrders.projectId, projectId))
    .orderBy(
      desc(salesOrders.createdAt),
      asc(salesOrderBillingItems.order),
    );
}
