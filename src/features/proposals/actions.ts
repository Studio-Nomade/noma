"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  proposals,
  proposalServices,
  proposalTeam,
  proposalNotes,
  teamMembers,
  projects,
  servicePackageItems,
  serviceVariants,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import {
  DISCOUNT_KINDS,
  CURRENCIES,
  SERVICE_PRIORITIES,
  type Currency,
  type DiscountKind,
  type ProposalStatus,
  type ServicePriority,
} from "@/types/enums";
import {
  BRAND_BUCKET,
  ensureBuckets,
  publicUrl,
  uploadToStorage,
} from "@/lib/supabase/storage";
import { SERVICE_TIERS, type ServiceTier } from "@/features/services/tiers";

/** Campos de texto editables de la propuesta. */
const EDITABLE_FIELDS = [
  "title",
  "context",
  "diagnosis",
  "mainObjective",
  "specificObjectives",
  "scope",
  "workStages",
  "deliverables",
  "timeline",
  "clientRequirements",
  "exclusions",
  "team",
  "commercialConditions",
  "nextAction",
] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

export async function createProposal(
  projectId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project) return { ok: false, error: "Proyecto no encontrado." };

    const [row] = await db
      .insert(proposals)
      .values({
        projectId: project.id,
        clientId: project.clientId,
        title: `Propuesta · ${project.name}`,
        createdBy: user.id,
      })
      .returning({ id: proposals.id });
    // la v1 es su propia raíz
    await db
      .update(proposals)
      .set({ rootId: row.id })
      .where(eq(proposals.id, row.id));
    revalidatePath("/proposals");
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return handleActionError(err, "createProposal");
  }
}

/** Clona la propuesta como una nueva versión (servicios + equipo + contenido). */
export async function createProposalVersion(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const [p] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, id))
      .limit(1);
    if (!p) return { ok: false, error: "Propuesta no encontrada." };
    const root = p.rootId ?? p.id;

    const [{ maxV }] = await db
      .select({ maxV: sql<number>`coalesce(max(version), 1)::int` })
      .from(proposals)
      .where(eq(proposals.rootId, root));
    const nextVersion = (maxV ?? p.version) + 1;

    const [row] = await db
      .insert(proposals)
      .values({
        projectId: p.projectId,
        clientId: p.clientId,
        title: p.title,
        context: p.context,
        diagnosis: p.diagnosis,
        mainObjective: p.mainObjective,
        specificObjectives: p.specificObjectives,
        scope: p.scope,
        workStages: p.workStages,
        deliverables: p.deliverables,
        timeline: p.timeline,
        clientRequirements: p.clientRequirements,
        exclusions: p.exclusions,
        team: p.team,
        commercialConditions: p.commercialConditions,
        includeMonthlyFeeCondition: p.includeMonthlyFeeCondition,
        nextAction: p.nextAction,
        // el descuento comercial se arrastra a la nueva versión
        discountLabel: p.discountLabel,
        discountKind: p.discountKind,
        discountValue: p.discountValue,
        status: "Borrador",
        version: nextVersion,
        rootId: root,
        createdBy: user.id,
      })
      .returning({ id: proposals.id });

    // copiar servicios y equipo
    const svc = await db
      .select()
      .from(proposalServices)
      .where(eq(proposalServices.proposalId, id));
    if (svc.length) {
      await db.insert(proposalServices).values(
        svc.map((s) => ({
          proposalId: row.id,
          serviceId: s.serviceId,
          variantTier: s.variantTier,
          position: s.position,
          quantity: s.quantity,
          priority: s.priority,
          customPriceAmount: s.customPriceAmount,
          customPriceCurrency: s.customPriceCurrency,
        })),
      );
    }
    const tm = await db
      .select()
      .from(proposalTeam)
      .where(eq(proposalTeam.proposalId, id));
    if (tm.length) {
      await db.insert(proposalTeam).values(
        tm.map((t) => ({
          proposalId: row.id,
          memberId: t.memberId,
          roleInProject: t.roleInProject,
          position: t.position,
        })),
      );
    }

    revalidatePath("/proposals");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return handleActionError(err, "createProposalVersion");
  }
}

export async function addProposalNote(
  rootId: string,
  body: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const text = body.trim();
    if (!text) return { ok: false, error: "El comentario está vacío." };
    await db.insert(proposalNotes).values({
      rootId,
      authorId: user.id,
      authorEmail: user.email ?? null,
      body: text,
    });
    revalidatePath("/proposals");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "addProposalNote");
  }
}

export async function updateProposalField(
  id: string,
  field: EditableField,
  value: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    if (!EDITABLE_FIELDS.includes(field)) {
      return { ok: false, error: "Campo no editable." };
    }
    await db
      .update(proposals)
      .set({ [field]: value.trim() || null, updatedAt: new Date() })
      .where(eq(proposals.id, id));
    revalidatePath(`/proposals/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateProposalField");
  }
}

export async function setProposalStatus(
  id: string,
  status: ProposalStatus,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db
      .update(proposals)
      .set({ status, updatedAt: new Date() })
      .where(eq(proposals.id, id));
    revalidatePath("/proposals");
    revalidatePath(`/proposals/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "setProposalStatus");
  }
}

export async function addProposalService(
  proposalId: string,
  serviceId: string,
  variantTier: ServiceTier = "START",
): Promise<ActionResult> {
  try {
    await requireUser();
    if (!SERVICE_TIERS.includes(variantTier)) {
      return { ok: false, error: "Variante inválida." };
    }
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(proposalServices)
      .where(eq(proposalServices.proposalId, proposalId));
    await db
      .insert(proposalServices)
      .values({ proposalId, serviceId, variantTier, position: count })
      .onConflictDoNothing();
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "addProposalService");
  }
}

export async function updateProposalServiceVariant(
  rowId: string,
  proposalId: string,
  variantTier: ServiceTier,
): Promise<ActionResult> {
  try {
    await requireUser();
    if (!SERVICE_TIERS.includes(variantTier)) {
      return { ok: false, error: "Variante inválida." };
    }
    const [row] = await db
      .select({ serviceId: proposalServices.serviceId })
      .from(proposalServices)
      .where(
        and(
          eq(proposalServices.id, rowId),
          eq(proposalServices.proposalId, proposalId),
        ),
      )
      .limit(1);
    if (!row) return { ok: false, error: "Servicio no encontrado." };
    const [variant] = await db
      .select({ id: serviceVariants.id })
      .from(serviceVariants)
      .where(
        and(
          eq(serviceVariants.serviceId, row.serviceId),
          eq(serviceVariants.tier, variantTier),
          eq(serviceVariants.enabled, true),
        ),
      )
      .limit(1);
    if (!variant && variantTier !== "START") {
      return { ok: false, error: "Esta variante no está habilitada." };
    }
    await db
      .update(proposalServices)
      .set({
        variantTier,
        customPriceAmount: null,
        customPriceCurrency: null,
      })
      .where(eq(proposalServices.id, rowId));
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "updateProposalServiceVariant");
  }
}

export async function addServicePackageToProposal(
  proposalId: string,
  packageId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    const ids = z.object({
      proposalId: z.string().uuid(),
      packageId: z.string().uuid(),
    }).parse({ proposalId, packageId });
    const lines = await db
      .select()
      .from(servicePackageItems)
      .where(eq(servicePackageItems.packageId, ids.packageId))
      .orderBy(servicePackageItems.position);
    if (lines.length === 0) {
      return { ok: false, error: "El paquete no contiene servicios." };
    }
    await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(proposalServices)
        .where(eq(proposalServices.proposalId, ids.proposalId));
      let position = existing.length;
      for (const line of lines) {
        const current = existing.find(
          (item) => item.serviceId === line.serviceId,
        );
        if (current) {
          await tx
            .update(proposalServices)
            .set({
              variantTier: line.variantTier,
              quantity: current.quantity + line.quantity,
              customPriceAmount: null,
              customPriceCurrency: null,
            })
            .where(eq(proposalServices.id, current.id));
        } else {
          await tx.insert(proposalServices).values({
            proposalId: ids.proposalId,
            serviceId: line.serviceId,
            variantTier: line.variantTier,
            quantity: line.quantity,
            position,
          });
          position += 1;
        }
      }
    });
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "addServicePackageToProposal");
  }
}

export async function removeProposalService(
  rowId: string,
  proposalId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db
      .delete(proposalServices)
      .where(
        and(
          eq(proposalServices.id, rowId),
          eq(proposalServices.proposalId, proposalId),
        ),
      );
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "removeProposalService");
  }
}

/** Cambia la prioridad (recargo) de un servicio dentro de la cotización. */
export async function updateProposalServicePriority(
  rowId: string,
  proposalId: string,
  priority: ServicePriority,
): Promise<ActionResult> {
  try {
    await requireUser();
    if (!SERVICE_PRIORITIES.includes(priority)) {
      return { ok: false, error: "Prioridad inválida." };
    }
    await db
      .update(proposalServices)
      .set({ priority })
      .where(
        and(
          eq(proposalServices.id, rowId),
          eq(proposalServices.proposalId, proposalId),
        ),
      );
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateProposalServicePriority");
  }
}

/** Cambia la cantidad de un servicio (ej. 3 videos). Mínimo 1. */
export async function updateProposalServiceQuantity(
  rowId: string,
  proposalId: string,
  quantity: number,
): Promise<ActionResult> {
  try {
    await requireUser();
    const qty = Math.max(1, Math.min(999, Math.floor(quantity)));
    if (!Number.isFinite(qty)) {
      return { ok: false, error: "Cantidad inválida." };
    }
    await db
      .update(proposalServices)
      .set({ quantity: qty })
      .where(
        and(
          eq(proposalServices.id, rowId),
          eq(proposalServices.proposalId, proposalId),
        ),
      );
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateProposalServiceQuantity");
  }
}

/** Personaliza el valor unitario y moneda de una línea sin alterar el catálogo. */
export async function updateProposalServicePrice(
  rowId: string,
  proposalId: string,
  amount: number,
  currency: Currency,
): Promise<ActionResult> {
  try {
    await requireUser();
    const input = z
      .object({
        rowId: z.string().uuid(),
        proposalId: z.string().uuid(),
        amount: z.number().finite().nonnegative().max(999_999_999),
        currency: z.enum(CURRENCIES),
      })
      .parse({ rowId, proposalId, amount, currency });
    await db
      .update(proposalServices)
      .set({
        customPriceAmount: String(input.amount),
        customPriceCurrency: input.currency,
      })
      .where(
        and(
          eq(proposalServices.id, input.rowId),
          eq(proposalServices.proposalId, input.proposalId),
        ),
      );
    revalidatePath(`/proposals/${input.proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateProposalServicePrice");
  }
}

export async function updateMonthlyFeeCondition(
  proposalId: string,
  enabled: boolean,
): Promise<ActionResult> {
  try {
    await requireUser();
    const input = z
      .object({ proposalId: z.string().uuid(), enabled: z.boolean() })
      .parse({ proposalId, enabled });
    await db
      .update(proposals)
      .set({
        includeMonthlyFeeCondition: input.enabled,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, input.proposalId));
    revalidatePath(`/proposals/${input.proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateMonthlyFeeCondition");
  }
}

/** Guarda el descuento comercial de la cotización (nombre + tipo + valor). */
export async function updateProposalDiscount(
  proposalId: string,
  input: { label: string; kind: DiscountKind | null; value: number | null },
): Promise<ActionResult> {
  try {
    await requireUser();
    const hasDiscount =
      input.kind != null && input.value != null && input.value > 0;
    if (input.kind != null && !DISCOUNT_KINDS.includes(input.kind)) {
      return { ok: false, error: "Tipo de descuento inválido." };
    }
    await db
      .update(proposals)
      .set({
        discountLabel: hasDiscount ? input.label.trim() || "Descuento" : null,
        discountKind: hasDiscount ? input.kind : null,
        discountValue: hasDiscount ? String(input.value) : null,
      })
      .where(eq(proposals.id, proposalId));
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateProposalDiscount");
  }
}

export async function addProposalTeamMember(
  proposalId: string,
  memberId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    const [member] = await db
      .select({ roleTitle: teamMembers.roleTitle })
      .from(teamMembers)
      .where(eq(teamMembers.id, memberId))
      .limit(1);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(proposalTeam)
      .where(eq(proposalTeam.proposalId, proposalId));
    await db
      .insert(proposalTeam)
      .values({
        proposalId,
        memberId,
        roleInProject: member?.roleTitle ?? null,
        position: count,
      })
      .onConflictDoNothing();
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "addProposalTeamMember");
  }
}

const manualTeamSchema = z.object({
  proposalId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  roleTitle: z.string().trim().min(2).max(120),
});

/** Crea un integrante invitado/manual y lo incorpora a esta propuesta. */
export async function addManualProposalTeamMember(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const input = manualTeamSchema.parse(Object.fromEntries(formData));
    const file = formData.get("photo");
    let photoUrl: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) {
        return { ok: false, error: "La foto supera el máximo de 5 MB." };
      }
      if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
        return { ok: false, error: "Usa una foto JPG, PNG o WEBP." };
      }
      const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "jpg";
      const path = `proposal-team/${input.proposalId}/${randomUUID()}.${extension}`;
      await ensureBuckets();
      await uploadToStorage(
        BRAND_BUCKET,
        path,
        Buffer.from(await file.arrayBuffer()),
        file.type,
      );
      photoUrl = publicUrl(BRAND_BUCKET, path);
    }
    const [member] = await db
      .insert(teamMembers)
      .values({
        name: input.name,
        roleTitle: input.roleTitle,
        photoUrl,
        // Invitado evita que un perfil exclusivo del deck aparezca como
        // colaborador activo en Personas, briefs u otros selectores globales.
        status: "Invitado",
        createdBy: user.id,
      })
      .returning({ id: teamMembers.id });
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(proposalTeam)
      .where(eq(proposalTeam.proposalId, input.proposalId));
    await db.insert(proposalTeam).values({
      proposalId: input.proposalId,
      memberId: member.id,
      roleInProject: input.roleTitle,
      position: count,
    });
    revalidatePath(`/proposals/${input.proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "addManualProposalTeamMember");
  }
}

export async function removeProposalTeamMember(
  rowId: string,
  proposalId: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db.delete(proposalTeam).where(eq(proposalTeam.id, rowId));
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "removeProposalTeamMember");
  }
}

export async function updateProposalTeamRole(
  rowId: string,
  proposalId: string,
  roleInProject: string,
): Promise<ActionResult> {
  try {
    await requireUser();
    await db
      .update(proposalTeam)
      .set({ roleInProject: roleInProject.trim() || null })
      .where(eq(proposalTeam.id, rowId));
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateProposalTeamRole");
  }
}

/** Guarda las etapas del cronograma (para la carta Gantt). */
export async function updateProposalStages(
  id: string,
  stages: (
    | {
        kind?: "stage";
        name: string;
        start: string;
        end: string;
      }
    | { kind: "milestone"; date: string; title?: string; description: string }
  )[],
): Promise<ActionResult> {
  try {
    await requireUser();
    const clean: (
      | {
          kind: "stage";
          name: string;
          start: string;
          end: string;
        }
      | { kind: "milestone"; date: string; title?: string; description: string }
    )[] = [];
    for (const item of stages) {
      if (item.kind === "milestone") {
        if (item.date && (item.title?.trim() || item.description.trim())) {
          clean.push({
            kind: "milestone",
            date: item.date,
            title: item.title?.trim() || "Hito",
            description: item.description.trim(),
          });
        }
        continue;
      }
      if (item.name.trim() && item.start && item.end) {
        clean.push({
          kind: "stage",
          name: item.name.trim(),
          start: item.start,
          end: item.end,
        });
      }
    }
    await db
      .update(proposals)
      .set({ timelineStages: clean, updatedAt: new Date() })
      .where(eq(proposals.id, id));
    revalidatePath(`/proposals/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateProposalStages");
  }
}

/** Guarda todas las secciones de la propuesta de una vez (un solo "Guardar"). */
export async function saveProposalContent(
  id: string,
  values: Partial<Record<EditableField, string>>,
): Promise<ActionResult> {
  try {
    await requireUser();
    const patch: Record<string, string | null> = {};
    for (const f of EDITABLE_FIELDS) {
      if (f in values) patch[f] = (values[f] ?? "").trim() || null;
    }
    await db
      .update(proposals)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(proposals.id, id));
    revalidatePath(`/proposals/${id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "saveProposalContent");
  }
}

/** Las propuestas sí se eliminan (a diferencia de clientes/proyectos). */
export async function deleteProposal(id: string): Promise<ActionResult> {
  try {
    await requireUser();
    await db.delete(proposals).where(eq(proposals.id, id));
    revalidatePath("/proposals");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "deleteProposal");
  }
}
