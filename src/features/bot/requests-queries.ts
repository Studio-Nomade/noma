import "server-only";

import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  botAuthorizedSenders,
  botMessages,
  clientRequests,
  clients,
  projects,
} from "@/db/schema";

export type RequestFilters = {
  clientId?: string;
  projectId?: string;
  scopeClass?: string;
  status?: string;
  search?: string;
  from?: Date;
  to?: Date;
};

export async function listRequests(
  filters: RequestFilters,
  pagination: { page: number; pageSize: number },
) {
  const conditions: SQL[] = [];
  if (filters.clientId) {
    conditions.push(eq(clientRequests.clientId, filters.clientId));
  }
  if (filters.projectId) {
    conditions.push(eq(clientRequests.projectId, filters.projectId));
  }
  if (filters.scopeClass) {
    conditions.push(eq(clientRequests.scopeClass, filters.scopeClass));
  }
  if (filters.status) {
    conditions.push(eq(clientRequests.status, filters.status));
  }
  if (filters.from) {
    conditions.push(gte(clientRequests.createdAt, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(clientRequests.createdAt, filters.to));
  }
  if (filters.search?.trim()) {
    const needle = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(clientRequests.normalizedSummary, needle),
        ilike(clientRequests.rawText, needle),
        ilike(clients.companyName, needle),
        ilike(projects.name, needle),
        ilike(botAuthorizedSenders.displayName, needle),
      )!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const base = {
    id: clientRequests.id,
    summary: clientRequests.normalizedSummary,
    rawText: clientRequests.rawText,
    scopeClass: clientRequests.scopeClass,
    scopeReason: clientRequests.scopeReason,
    status: clientRequests.status,
    asanaUrl: clientRequests.asanaUrl,
    createdAt: clientRequests.createdAt,
    clientId: clientRequests.clientId,
    clientName: clients.companyName,
    projectId: clientRequests.projectId,
    projectName: projects.name,
    senderName: botAuthorizedSenders.displayName,
    senderProfile: botAuthorizedSenders.profile,
  };

  const [rows, totalRows] = await Promise.all([
    db
      .select(base)
      .from(clientRequests)
      .innerJoin(clients, eq(clientRequests.clientId, clients.id))
      .innerJoin(projects, eq(clientRequests.projectId, projects.id))
      .leftJoin(
        botAuthorizedSenders,
        eq(clientRequests.senderId, botAuthorizedSenders.id),
      )
      .where(where)
      .orderBy(desc(clientRequests.createdAt))
      .limit(pagination.pageSize)
      .offset((pagination.page - 1) * pagination.pageSize),
    db
      .select({ value: count() })
      .from(clientRequests)
      .innerJoin(clients, eq(clientRequests.clientId, clients.id))
      .innerJoin(projects, eq(clientRequests.projectId, projects.id))
      .leftJoin(
        botAuthorizedSenders,
        eq(clientRequests.senderId, botAuthorizedSenders.id),
      )
      .where(where),
  ]);
  return { rows, total: totalRows[0]?.value ?? 0 };
}

export async function getRequestFilterOptions() {
  const [clientRows, projectRows] = await Promise.all([
    db
      .selectDistinct({ id: clients.id, name: clients.companyName })
      .from(clientRequests)
      .innerJoin(clients, eq(clientRequests.clientId, clients.id))
      .orderBy(clients.companyName),
    db
      .selectDistinct({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
      })
      .from(clientRequests)
      .innerJoin(projects, eq(clientRequests.projectId, projects.id))
      .orderBy(projects.name),
  ]);
  return { clients: clientRows, projects: projectRows };
}

export async function getRequestDetail(id: string) {
  const [request] = await db
    .select({
      id: clientRequests.id,
      conversationId: clientRequests.conversationId,
      summary: clientRequests.normalizedSummary,
      rawText: clientRequests.rawText,
      scopeClass: clientRequests.scopeClass,
      scopeReason: clientRequests.scopeReason,
      estimatedUnits: clientRequests.estimatedUnits,
      status: clientRequests.status,
      asanaUrl: clientRequests.asanaUrl,
      asanaTaskGid: clientRequests.asanaTaskGid,
      createdAt: clientRequests.createdAt,
      updatedAt: clientRequests.updatedAt,
      clientId: clientRequests.clientId,
      clientName: clients.companyName,
      projectId: clientRequests.projectId,
      projectName: projects.name,
      senderName: botAuthorizedSenders.displayName,
      senderProfile: botAuthorizedSenders.profile,
    })
    .from(clientRequests)
    .innerJoin(clients, eq(clientRequests.clientId, clients.id))
    .innerJoin(projects, eq(clientRequests.projectId, projects.id))
    .leftJoin(
      botAuthorizedSenders,
      eq(clientRequests.senderId, botAuthorizedSenders.id),
    )
    .where(eq(clientRequests.id, id))
    .limit(1);
  if (!request) return null;

  const messages = request.conversationId
    ? await db
        .select({
          id: botMessages.id,
          role: botMessages.role,
          content: botMessages.content,
          meta: botMessages.meta,
          createdAt: botMessages.createdAt,
        })
        .from(botMessages)
        .where(eq(botMessages.conversationId, request.conversationId))
        .orderBy(botMessages.createdAt)
    : [];
  return { ...request, messages };
}
