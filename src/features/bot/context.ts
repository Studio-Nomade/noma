import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  botChannels,
  botMessages,
  clients,
  projects,
  proposals,
  proposalServices,
  services,
  type BotChannel,
} from "@/db/schema";

const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

const contextPackSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  client: z.object({
    name: z.string(),
    industry: z.string().nullable(),
  }),
  project: z.object({
    name: z.string(),
    type: z.string().nullable(),
    description: z.string().nullable(),
    objective: z.string().nullable(),
    areas: z.array(z.string()),
  }),
  services: z.array(
    z.object({
      name: z.string(),
      area: z.string(),
      description: z.string().nullable(),
      deliverables: z.string().nullable(),
    }),
  ),
  tone: z.string(),
});

export type BotContextPack = z.infer<typeof contextPackSchema>;
export type BotChannelContextInput = Pick<
  BotChannel,
  "id" | "projectId" | "clientId" | "asanaProjectGid" | "contextPack"
>;

export async function buildContextPack(
  botChannel: BotChannelContextInput,
): Promise<BotContextPack> {
  const cached = contextPackSchema.safeParse(botChannel.contextPack);
  if (
    cached.success &&
    Date.now() - new Date(cached.data.generatedAt).getTime() < CACHE_TTL_MS
  ) {
    return cached.data;
  }

  const [[client], [project], [latestProposal]] = await Promise.all([
    db
      .select({
        name: clients.companyName,
        industry: clients.industry,
      })
      .from(clients)
      .where(eq(clients.id, botChannel.clientId))
      .limit(1),
    db
      .select({
        name: projects.name,
        type: projects.projectType,
        description: projects.description,
        objective: projects.mainObjective,
        area: projects.area,
        areas: projects.areas,
      })
      .from(projects)
      .where(eq(projects.id, botChannel.projectId))
      .limit(1),
    db
      .select({ id: proposals.id })
      .from(proposals)
      .where(eq(proposals.projectId, botChannel.projectId))
      .orderBy(desc(proposals.version), desc(proposals.createdAt))
      .limit(1),
  ]);

  if (!client || !project) {
    throw new Error("El canal no tiene cliente o proyecto vigente.");
  }

  const serviceRows = latestProposal
    ? await db
        .select({
          id: services.id,
          name: services.name,
          area: services.area,
          description: services.description,
          deliverables: services.deliverables,
        })
        .from(proposalServices)
        .innerJoin(services, eq(proposalServices.serviceId, services.id))
        .where(
          and(
            eq(proposalServices.proposalId, latestProposal.id),
            eq(services.status, "Activo"),
          ),
        )
    : [];

  const uniqueServices = [
    ...new Map(serviceRows.map((service) => [service.id, service])).values(),
  ].map((service) => ({
    name: service.name,
    area: service.area,
    description: service.description,
    deliverables: service.deliverables,
  }));

  const pack: BotContextPack = {
    version: 1,
    generatedAt: new Date().toISOString(),
    client,
    project: {
      name: project.name,
      type: project.type,
      description: project.description,
      objective: project.objective,
      areas: project.areas.length ? project.areas : [project.area],
    },
    services: uniqueServices,
    tone:
      "Editorial, claro y cálido. Directo sin ser frío; profesional sin lenguaje burocrático.",
  };

  await db
    .update(botChannels)
    .set({ contextPack: pack, updatedAt: new Date() })
    .where(eq(botChannels.id, botChannel.id));
  return pack;
}

export async function getConversationHistory(
  conversationId: string,
  limit = 20,
) {
  const rows = await db
    .select({
      role: botMessages.role,
      content: botMessages.content,
      meta: botMessages.meta,
      createdAt: botMessages.createdAt,
    })
    .from(botMessages)
    .where(eq(botMessages.conversationId, conversationId))
    .orderBy(desc(botMessages.createdAt))
    .limit(Math.max(1, Math.min(limit, 50)));
  return rows.reverse();
}
