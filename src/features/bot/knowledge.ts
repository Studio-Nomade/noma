import "server-only";

import { and, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeDocs, services } from "@/db/schema";
import type { Area } from "@/types/enums";

export type KnowledgeFragment = {
  source: "knowledge" | "service";
  title: string;
  area: Area | null;
  excerpt: string;
};

const STOP_WORDS = new Set([
  "para",
  "como",
  "este",
  "esta",
  "esto",
  "desde",
  "hasta",
  "sobre",
  "entre",
  "quiero",
  "necesito",
  "tiene",
  "hacer",
]);

export async function searchKnowledge(
  query: string,
  area?: Area | null,
): Promise<KnowledgeFragment[]> {
  const terms = keywords(query);
  if (!terms.length) return [];

  const docSearch = termConditions(terms, [
    knowledgeDocs.title,
    knowledgeDocs.content,
  ]);
  const serviceSearch = termConditions(terms, [
    services.name,
    services.description,
    services.deliverables,
    services.requirements,
  ]);

  const [docs, serviceRows] = await Promise.all([
    db
      .select({
        title: knowledgeDocs.title,
        area: knowledgeDocs.area,
        content: knowledgeDocs.content,
      })
      .from(knowledgeDocs)
      .where(and(area ? eq(knowledgeDocs.area, area) : undefined, docSearch))
      .limit(5),
    db
      .select({
        title: services.name,
        area: services.area,
        description: services.description,
        deliverables: services.deliverables,
        requirements: services.requirements,
      })
      .from(services)
      .where(
        and(
          eq(services.status, "Activo"),
          area ? eq(services.area, area) : undefined,
          serviceSearch,
        ),
      )
      .limit(5),
  ]);

  return [
    ...docs.map((doc) => ({
      source: "knowledge" as const,
      title: doc.title,
      area: doc.area,
      excerpt: excerpt(doc.content),
    })),
    ...serviceRows.map((service) => ({
      source: "service" as const,
      title: service.title,
      area: service.area,
      excerpt: excerpt(
        [service.description, service.deliverables, service.requirements]
          .filter(Boolean)
          .join(" · "),
      ),
    })),
  ].slice(0, 6);
}

function keywords(value: string) {
  return [
    ...new Set(
      value
        .toLowerCase()
        .match(/[\p{L}\p{N}]{4,}/gu)
        ?.filter((term) => !STOP_WORDS.has(term)) ?? [],
    ),
  ].slice(0, 6);
}

function termConditions(
  terms: string[],
  columns: Parameters<typeof ilike>[0][],
) {
  const conditions: SQL[] = [];
  for (const term of terms) {
    const pattern = `%${escapeLike(term)}%`;
    for (const column of columns) conditions.push(ilike(column, pattern));
  }
  return or(...conditions);
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function excerpt(value: string | null, max = 600) {
  const compact = value?.replace(/\s+/g, " ").trim() ?? "";
  return compact.length > max ? `${compact.slice(0, max)}…` : compact;
}
