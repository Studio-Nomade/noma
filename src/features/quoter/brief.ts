import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientContacts, clients, quoterRuns, services } from "@/db/schema";
import type { Area } from "@/types/enums";
import type { BriefExtraction } from "@/features/ai/brief-processor";
import { quoterAiConfig } from "./ai-config";
import { clientPatchFromBrief, mapBriefAi } from "./brief-map";
import { quoterStructured } from "./llm";
import { briefSystemPrompt } from "./prompt";
import { briefAiSchema } from "./schema";

export function briefAiEnabled() {
  return quoterAiConfig("brief") != null;
}

/**
 * Notas de reunión → brief con Claude. Devuelve null si la IA no está
 * configurada (el llamador usa la heurística). Si la IA falla, lanza: el
 * llamador decide si cae a la heurística.
 */
export async function extractBriefWithAi(input: {
  projectId: string;
  clientId: string | null;
  text: string;
  mainArea: Area;
  involvedAreas: Area[];
  user: { id: string; email?: string | null };
}): Promise<{ extraction: BriefExtraction; clientUpdated: string[] } | null> {
  if (!briefAiEnabled()) return null;

  const catalog = await db
    .select({ id: services.id, name: services.name, area: services.area })
    .from(services)
    .where(eq(services.status, "Activo"))
    .orderBy(services.area, services.name);
  const catalogNames = new Map(catalog.map((s) => [s.id, s.name]));
  const catalogIndex = catalog
    .map((s) => `- [${s.id}] ${s.area} · ${s.name}`)
    .join("\n");

  const [run] = await db
    .insert(quoterRuns)
    .values({
      kind: "brief",
      projectId: input.projectId,
      createdBy: input.user.id,
      createdByEmail: input.user.email ?? null,
      contextRefs: {
        notesChars: input.text.length,
        catalogSize: catalog.length,
      },
    })
    .returning({ id: quoterRuns.id });

  try {
    const result = await quoterStructured("brief", {
      feature: "quoter_brief",
      system: [
        { text: briefSystemPrompt([input.mainArea, ...input.involvedAreas]) },
        {
          text: `CATÁLOGO (id · área · servicio):\n${catalogIndex}`,
          cache: true,
        },
      ],
      input: `NOTAS DE LA REUNIÓN:\n${input.text.slice(0, 120_000)}`,
      schema: briefAiSchema,
      maxTokens: 8_000,
      timeoutMs: 120_000,
    });
    const extraction = mapBriefAi(result.data, {
      mainArea: input.mainArea,
      involvedAreas: input.involvedAreas,
      catalogNames,
    });
    const clientUpdated = input.clientId
      ? await completeClientRecord(input.clientId, result.data)
      : [];
    await db
      .update(quoterRuns)
      .set({
        status: "done",
        provider: result.provider,
        model: result.model,
        durationMs: result.durationMs,
        output: {
          clientProfile: result.data.client_profile,
          contacts: result.data.contacts,
          clientUpdated,
        },
        finishedAt: new Date(),
      })
      .where(eq(quoterRuns.id, run.id));
    return { extraction, clientUpdated };
  } catch (error) {
    await db
      .update(quoterRuns)
      .set({
        status: "failed",
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Error desconocido",
        finishedAt: new Date(),
      })
      .where(eq(quoterRuns.id, run.id));
    throw error;
  }
}

/** Completa la ficha del cliente con lo que dijo la reunión (sin pisar datos). */
async function completeClientRecord(
  clientId: string,
  data: import("./schema").BriefAiOutput,
): Promise<string[]> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) return [];
  const updated: string[] = [];
  const patch: Record<string, unknown> = clientPatchFromBrief(
    data.client_profile,
    client,
  );
  updated.push(...Object.keys(patch));

  const notes = data.client_profile.notes?.trim();
  if (notes && !client.internalNotes?.trim()) {
    patch.internalNotes = notes.slice(0, 2_000);
    updated.push("internalNotes");
  }
  const first = data.contacts.find((c) => c.name.trim());
  if (first && !client.contactName?.trim()) {
    patch.contactName = first.name.trim();
    if (first.role?.trim() && !client.contactRole?.trim())
      patch.contactRole = first.role.trim();
    updated.push("contactName");
  }
  if (Object.keys(patch).length) {
    await db
      .update(clients)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(clients.id, clientId));
  }

  for (const contact of data.contacts) {
    const email = contact.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (email.endsWith("@studionomade.cl")) continue;
    const [exists] = await db
      .select({ id: clientContacts.id })
      .from(clientContacts)
      .where(
        and(
          eq(clientContacts.clientId, clientId),
          sql`lower(${clientContacts.email}) = ${email}`,
        ),
      )
      .limit(1);
    if (exists) continue;
    await db.insert(clientContacts).values({
      clientId,
      name: contact.name.trim() || null,
      email,
      phone: contact.phone?.trim() || null,
      role: contact.role?.trim() || null,
    });
    updated.push(`contacto:${email}`);
  }
  return updated;
}
