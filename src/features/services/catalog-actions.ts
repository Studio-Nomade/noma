"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { db } from "@/db";
import {
  proposalServices,
  proposals,
  servicePackageItems,
  servicePackages,
  serviceSubareas,
  services,
} from "@/db/schema";
import { requireCatalogEditor } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import {
  deleteSubareaSchema,
  packageSchema,
  subareaSchema,
  type ServicePackageFormValues,
  type SubareaFormValues,
} from "./catalog-schema";

function emptyToNull(value?: string) {
  return value?.trim() ? value.trim() : null;
}

export async function createServiceSubarea(
  values: SubareaFormValues,
): Promise<ActionResult> {
  try {
    const user = await requireCatalogEditor();
    const data = subareaSchema.parse(values);
    const [row] = await db
      .insert(serviceSubareas)
      .values({
        ...data,
        description: emptyToNull(data.description),
        createdBy: user.id,
      })
      .returning({ id: serviceSubareas.id });
    await logActivity({
      entityType: "service_subarea",
      entityId: row.id,
      action: "service_subarea_created",
      actorId: user.id,
    });
    revalidatePath("/services");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "createServiceSubarea");
  }
}

export async function updateServiceSubarea(
  id: string,
  values: SubareaFormValues,
): Promise<ActionResult> {
  try {
    const user = await requireCatalogEditor();
    const data = subareaSchema.parse(values);
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(serviceSubareas)
        .where(eq(serviceSubareas.id, id))
        .limit(1);
      if (!current) throw new Error("Subárea no encontrada.");
      await tx
        .update(serviceSubareas)
        .set({
          ...data,
          description: emptyToNull(data.description),
          updatedAt: new Date(),
        })
        .where(eq(serviceSubareas.id, id));
      await tx
        .update(services)
        .set({ subarea: data.name, updatedAt: new Date() })
        .where(
          and(
            eq(services.area, current.area),
            eq(services.subarea, current.name),
          ),
        );
    });
    await logActivity({
      entityType: "service_subarea",
      entityId: id,
      action: "service_subarea_updated",
      actorId: user.id,
    });
    revalidatePath("/services");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "updateServiceSubarea");
  }
}

export async function deleteServiceSubarea(input: {
  id: string;
  moveToId?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireCatalogEditor();
    const data = deleteSubareaSchema.parse(input);
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(serviceSubareas)
        .where(eq(serviceSubareas.id, data.id))
        .limit(1);
      if (!current) throw new Error("Subárea no encontrada.");

      const assigned = await tx
        .select({ id: services.id })
        .from(services)
        .where(
          and(
            eq(services.area, current.area),
            eq(services.subarea, current.name),
          ),
        );
      let targetName: string | null = null;
      if (assigned.length > 0) {
        if (!data.moveToId) {
          throw new Error(
            "Esta subárea contiene servicios. Selecciona dónde moverlos.",
          );
        }
        const [target] = await tx
          .select()
          .from(serviceSubareas)
          .where(eq(serviceSubareas.id, data.moveToId))
          .limit(1);
        if (!target || target.area !== current.area) {
          throw new Error("La subárea de destino debe pertenecer a la misma área.");
        }
        targetName = target.name;
      }
      await tx
        .update(services)
        .set({ subarea: targetName, updatedAt: new Date() })
        .where(
          and(
            eq(services.area, current.area),
            eq(services.subarea, current.name),
          ),
        );
      await tx
        .delete(serviceSubareas)
        .where(eq(serviceSubareas.id, current.id));
    });
    await logActivity({
      entityType: "service_subarea",
      entityId: data.id,
      action: "service_subarea_deleted",
      actorId: user.id,
    });
    revalidatePath("/services");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "deleteServiceSubarea");
  }
}

function normalizePackage(values: ServicePackageFormValues) {
  const data = packageSchema.parse(values);
  return {
    header: {
      name: data.name,
      objective: emptyToNull(data.objective),
      niche: emptyToNull(data.niche),
      description: emptyToNull(data.description),
      status: data.status,
      suggestedByAi: data.suggestedByAi,
    },
    items: data.items,
  };
}

export async function createServicePackage(
  values: ServicePackageFormValues,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireCatalogEditor();
    const data = normalizePackage(values);
    const id = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(servicePackages)
        .values({ ...data.header, createdBy: user.id })
        .returning({ id: servicePackages.id });
      await tx.insert(servicePackageItems).values(
        data.items.map((item, position) => ({
          ...item,
          packageId: created.id,
          position,
          createdBy: user.id,
        })),
      );
      return created.id;
    });
    await logActivity({
      entityType: "service_package",
      entityId: id,
      action: "service_package_created",
      actorId: user.id,
    });
    revalidatePath("/services");
    return { ok: true, data: { id } };
  } catch (error) {
    return handleActionError(error, "createServicePackage");
  }
}

export async function updateServicePackage(
  id: string,
  values: ServicePackageFormValues,
): Promise<ActionResult> {
  try {
    const user = await requireCatalogEditor();
    const data = normalizePackage(values);
    await db.transaction(async (tx) => {
      await tx
        .update(servicePackages)
        .set({ ...data.header, updatedAt: new Date() })
        .where(eq(servicePackages.id, id));
      await tx
        .delete(servicePackageItems)
        .where(eq(servicePackageItems.packageId, id));
      await tx.insert(servicePackageItems).values(
        data.items.map((item, position) => ({
          ...item,
          packageId: id,
          position,
          createdBy: user.id,
        })),
      );
    });
    await logActivity({
      entityType: "service_package",
      entityId: id,
      action: "service_package_updated",
      actorId: user.id,
    });
    revalidatePath("/services");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "updateServicePackage");
  }
}

export async function deleteServicePackage(id: string): Promise<ActionResult> {
  try {
    await requireCatalogEditor();
    await db.delete(servicePackages).where(eq(servicePackages.id, id));
    revalidatePath("/services");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "deleteServicePackage");
  }
}

const packageSuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      name: z.string(),
      objective: z.string(),
      niche: z.string(),
      description: z.string(),
      serviceIds: z.array(z.string()),
    }),
  ),
});

export type PackageSuggestion = z.infer<
  typeof packageSuggestionsSchema
>["suggestions"][number];

export async function suggestServicePackages(): Promise<
  ActionResult<{ suggestions: PackageSuggestion[] }>
> {
  try {
    await requireCatalogEditor();
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return {
        ok: false,
        error: "Configura OPENAI_API_KEY para generar paquetes propuestos.",
      };
    }

    const recent = await db
      .select({ id: proposals.id })
      .from(proposals)
      .orderBy(desc(proposals.createdAt))
      .limit(40);
    if (recent.length < 2) {
      return {
        ok: false,
        error: "Se necesitan al menos dos propuestas para detectar patrones.",
      };
    }
    const lines = await db
      .select({
        proposalId: proposalServices.proposalId,
        serviceId: services.id,
        serviceName: services.name,
        area: services.area,
      })
      .from(proposalServices)
      .innerJoin(services, eq(proposalServices.serviceId, services.id))
      .where(
        inArray(
          proposalServices.proposalId,
          recent.map((proposal) => proposal.id),
        ),
      );
    const combinations = new Map<
      string,
      { id: string; name: string; area: string }[]
    >();
    for (const line of lines) {
      const list = combinations.get(line.proposalId) ?? [];
      list.push({
        id: line.serviceId,
        name: line.serviceName,
        area: line.area,
      });
      combinations.set(line.proposalId, list);
    }

    const client = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-5.6-sol",
      input: [
        {
          role: "system",
          content:
            "Propón hasta 4 paquetes comerciales reutilizables a partir de patrones de coocurrencia. Usa exclusivamente los IDs entregados, evita datos de clientes y no inventes servicios. Cada paquete debe combinar servicios complementarios y tener un objetivo claro.",
        },
        {
          role: "user",
          content: JSON.stringify([...combinations.values()]),
        },
      ],
      text: {
        format: zodTextFormat(packageSuggestionsSchema, "package_suggestions"),
      },
    });
    const parsed = packageSuggestionsSchema.parse(response.output_parsed);
    const validIds = new Set(lines.map((line) => line.serviceId));
    return {
      ok: true,
      data: {
        suggestions: parsed.suggestions
          .map((suggestion) => ({
            ...suggestion,
            serviceIds: [...new Set(suggestion.serviceIds)].filter((id) =>
              validIds.has(id),
            ),
          }))
          .filter((suggestion) => suggestion.serviceIds.length >= 2),
      },
    };
  } catch (error) {
    return handleActionError(error, "suggestServicePackages");
  }
}
