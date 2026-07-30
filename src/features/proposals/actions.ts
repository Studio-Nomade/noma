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
  servicePackages,
  serviceVariants,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import {
  DISCOUNT_KINDS,
  CURRENCIES,
  PROPOSAL_STATUSES,
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

const proposalIdSchema = z.string().uuid("Identificador de propuesta inválido.");
const rowIdSchema = z.string().uuid("Identificador de fila inválido.");

function failValidation(message: string): never {
  z.boolean().refine(Boolean, { message }).parse(false);
  throw new Error("Validación no aplicada.");
}

async function assertProposalEditable(
  reader: Pick<typeof db, "select">,
  proposalId: string,
) {
  const [proposal] = await reader
    .select({ status: proposals.status })
    .from(proposals)
    .where(eq(proposals.id, proposalId))
    .limit(1)
    .for("update");
  if (!proposal) failValidation("La propuesta no existe.");
  if (proposal.status === "Aprobada") {
    failValidation(
      "La propuesta está aprobada y no admite cambios. Crea una nueva versión para editarla.",
    );
  }
}

async function assertEnabledVariant(
  reader: Pick<typeof db, "select">,
  serviceId: string,
  variantTier: ServiceTier,
) {
  const [variant] = await reader
    .select({ id: serviceVariants.id })
    .from(serviceVariants)
    .where(
      and(
        eq(serviceVariants.serviceId, serviceId),
        eq(serviceVariants.tier, variantTier),
        eq(serviceVariants.enabled, true),
      ),
    )
    .limit(1);
  if (!variant) {
    failValidation("Esta variante no existe o no está habilitada.");
  }
}

export async function createProposal(
  projectId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const validProjectId = z.string().uuid().parse(projectId);
    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
      })
      .from(projects)
      .where(eq(projects.id, validProjectId))
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
    revalidatePath(`/projects/${validProjectId}`);
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
    const proposalId = proposalIdSchema.parse(id);
    const [p] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
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
      .where(eq(proposalServices.proposalId, proposalId));
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
      .where(eq(proposalTeam.proposalId, proposalId));
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
    const input = z
      .object({
        rootId: proposalIdSchema,
        body: z.string().trim().min(1, "El comentario está vacío.").max(5_000),
      })
      .parse({ rootId, body });
    await db.insert(proposalNotes).values({
      rootId: input.rootId,
      authorId: user.id,
      authorEmail: user.email ?? null,
      body: input.body,
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
    const proposalId = proposalIdSchema.parse(id);
    if (!EDITABLE_FIELDS.includes(field)) {
      return { ok: false, error: "Campo no editable." };
    }
    await assertProposalEditable(db, proposalId);
    await db
      .update(proposals)
      .set({ [field]: value.trim() || null, updatedAt: new Date() })
      .where(eq(proposals.id, proposalId));
    revalidatePath(`/proposals/${proposalId}`);
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
    const input = z
      .object({
        id: proposalIdSchema,
        status: z.enum(PROPOSAL_STATUSES),
      })
      .parse({ id, status });
    await db
      .update(proposals)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(proposals.id, input.id));
    revalidatePath("/proposals");
    revalidatePath(`/proposals/${input.id}`);
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
    const input = z
      .object({
        proposalId: proposalIdSchema,
        serviceId: z.string().uuid(),
        variantTier: z.enum(SERVICE_TIERS),
      })
      .parse({ proposalId, serviceId, variantTier });
    await db.transaction(async (tx) => {
      await assertProposalEditable(tx, input.proposalId);
      await assertEnabledVariant(tx, input.serviceId, input.variantTier);
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(proposalServices)
        .where(eq(proposalServices.proposalId, input.proposalId));
      await tx
        .insert(proposalServices)
        .values({
          proposalId: input.proposalId,
          serviceId: input.serviceId,
          variantTier: input.variantTier,
          position: count,
        })
        .onConflictDoNothing();
    });
    revalidatePath(`/proposals/${input.proposalId}`);
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
    const input = z
      .object({
        rowId: rowIdSchema,
        proposalId: proposalIdSchema,
        variantTier: z.enum(SERVICE_TIERS),
      })
      .parse({ rowId, proposalId, variantTier });
    await db.transaction(async (tx) => {
      await assertProposalEditable(tx, input.proposalId);
      const [row] = await tx
        .select({ serviceId: proposalServices.serviceId })
        .from(proposalServices)
        .where(
          and(
            eq(proposalServices.id, input.rowId),
            eq(proposalServices.proposalId, input.proposalId),
          ),
        )
        .limit(1);
      if (!row) failValidation("Servicio no encontrado.");
      await assertEnabledVariant(tx, row.serviceId, input.variantTier);
      await tx
        .update(proposalServices)
        .set({
          variantTier: input.variantTier,
          customPriceAmount: null,
          customPriceCurrency: null,
        })
        .where(
          and(
            eq(proposalServices.id, input.rowId),
            eq(proposalServices.proposalId, input.proposalId),
          ),
        );
    });
    revalidatePath(`/proposals/${input.proposalId}`);
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
      proposalId: proposalIdSchema,
      packageId: z.string().uuid("Identificador de paquete inválido."),
    }).parse({ proposalId, packageId });
    await db.transaction(async (tx) => {
      await assertProposalEditable(tx, ids.proposalId);
      const [servicePackage] = await tx
        .select({ status: servicePackages.status })
        .from(servicePackages)
        .where(eq(servicePackages.id, ids.packageId))
        .limit(1);
      if (!servicePackage || servicePackage.status !== "Activo") {
        failValidation("El paquete no existe o está inactivo.");
      }
      const lines = await tx
        .select()
        .from(servicePackageItems)
        .where(eq(servicePackageItems.packageId, ids.packageId))
        .orderBy(servicePackageItems.position);
      if (lines.length === 0) {
        failValidation("El paquete no contiene servicios.");
      }
      const uniqueServices = new Set(lines.map((line) => line.serviceId));
      if (uniqueServices.size !== lines.length) {
        failValidation("El paquete contiene servicios duplicados.");
      }
      for (const line of lines) {
        const tier = z.enum(SERVICE_TIERS).parse(line.variantTier);
        await assertEnabledVariant(tx, line.serviceId, tier);
      }
      const existing = await tx
        .select()
        .from(proposalServices)
        .where(eq(proposalServices.proposalId, ids.proposalId));
      const existingByService = new Map(
        existing.map((item) => [item.serviceId, item]),
      );
      let position = existing.length;
      for (const line of lines) {
        const current = existingByService.get(line.serviceId);
        if (current) {
          await tx
            .update(proposalServices)
            .set({
              variantTier: line.variantTier,
              quantity: Math.min(999, current.quantity + line.quantity),
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
          existingByService.set(line.serviceId, {
            id: "",
            proposalId: ids.proposalId,
            serviceId: line.serviceId,
            variantTier: line.variantTier,
            quantity: line.quantity,
            position,
            priority: "Normal",
            customPriceAmount: null,
            customPriceCurrency: null,
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
    const input = z
      .object({ rowId: rowIdSchema, proposalId: proposalIdSchema })
      .parse({ rowId, proposalId });
    await assertProposalEditable(db, input.proposalId);
    await db
      .delete(proposalServices)
      .where(
        and(
          eq(proposalServices.id, input.rowId),
          eq(proposalServices.proposalId, input.proposalId),
        ),
      );
    revalidatePath(`/proposals/${input.proposalId}`);
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
    const input = z
      .object({
        rowId: rowIdSchema,
        proposalId: proposalIdSchema,
        priority: z.enum(SERVICE_PRIORITIES),
      })
      .parse({ rowId, proposalId, priority });
    await assertProposalEditable(db, input.proposalId);
    await db
      .update(proposalServices)
      .set({ priority: input.priority })
      .where(
        and(
          eq(proposalServices.id, input.rowId),
          eq(proposalServices.proposalId, input.proposalId),
        ),
      );
    revalidatePath(`/proposals/${input.proposalId}`);
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
    const input = z
      .object({
        rowId: rowIdSchema,
        proposalId: proposalIdSchema,
        quantity: z.number().finite().int().min(1).max(999),
      })
      .parse({ rowId, proposalId, quantity: Math.floor(quantity) });
    await assertProposalEditable(db, input.proposalId);
    await db
      .update(proposalServices)
      .set({ quantity: input.quantity })
      .where(
        and(
          eq(proposalServices.id, input.rowId),
          eq(proposalServices.proposalId, input.proposalId),
        ),
      );
    revalidatePath(`/proposals/${input.proposalId}`);
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
    await assertProposalEditable(db, input.proposalId);
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
      .object({ proposalId: proposalIdSchema, enabled: z.boolean() })
      .parse({ proposalId, enabled });
    await assertProposalEditable(db, input.proposalId);
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
    const parsed = z
      .object({
        proposalId: proposalIdSchema,
        label: z.string().trim().max(120),
        kind: z.enum(DISCOUNT_KINDS).nullable(),
        value: z.number().finite().nonnegative().max(999_999_999).nullable(),
      })
      .parse({ proposalId, ...input });
    await assertProposalEditable(db, parsed.proposalId);
    const hasDiscount =
      parsed.kind != null && parsed.value != null && parsed.value > 0;
    await db
      .update(proposals)
      .set({
        discountLabel: hasDiscount ? parsed.label || "Descuento" : null,
        discountKind: hasDiscount ? parsed.kind : null,
        discountValue: hasDiscount ? String(parsed.value) : null,
      })
      .where(eq(proposals.id, parsed.proposalId));
    revalidatePath(`/proposals/${parsed.proposalId}`);
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
    const input = z
      .object({
        proposalId: proposalIdSchema,
        memberId: z.string().uuid("Identificador de integrante inválido."),
      })
      .parse({ proposalId, memberId });
    await assertProposalEditable(db, input.proposalId);
    const [member] = await db
      .select({ roleTitle: teamMembers.roleTitle })
      .from(teamMembers)
      .where(eq(teamMembers.id, input.memberId))
      .limit(1);
    if (!member) failValidation("El integrante no existe.");
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(proposalTeam)
      .where(eq(proposalTeam.proposalId, input.proposalId));
    await db
      .insert(proposalTeam)
      .values({
        proposalId: input.proposalId,
        memberId: input.memberId,
        roleInProject: member.roleTitle ?? null,
        position: count,
      })
      .onConflictDoNothing();
    revalidatePath(`/proposals/${input.proposalId}`);
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
    await assertProposalEditable(db, input.proposalId);
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
    const input = z
      .object({ rowId: rowIdSchema, proposalId: proposalIdSchema })
      .parse({ rowId, proposalId });
    await assertProposalEditable(db, input.proposalId);
    await db
      .delete(proposalTeam)
      .where(
        and(
          eq(proposalTeam.id, input.rowId),
          eq(proposalTeam.proposalId, input.proposalId),
        ),
      );
    revalidatePath(`/proposals/${input.proposalId}`);
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
    const input = z
      .object({
        rowId: rowIdSchema,
        proposalId: proposalIdSchema,
        roleInProject: z.string().trim().max(120),
      })
      .parse({ rowId, proposalId, roleInProject });
    await assertProposalEditable(db, input.proposalId);
    await db
      .update(proposalTeam)
      .set({ roleInProject: input.roleInProject || null })
      .where(
        and(
          eq(proposalTeam.id, input.rowId),
          eq(proposalTeam.proposalId, input.proposalId),
        ),
      );
    revalidatePath(`/proposals/${input.proposalId}`);
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
    const proposalId = proposalIdSchema.parse(id);
    await assertProposalEditable(db, proposalId);
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
      .where(eq(proposals.id, proposalId));
    revalidatePath(`/proposals/${proposalId}`);
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
    const proposalId = proposalIdSchema.parse(id);
    await assertProposalEditable(db, proposalId);
    const patch: Record<string, string | null> = {};
    for (const f of EDITABLE_FIELDS) {
      if (f in values) patch[f] = (values[f] ?? "").trim() || null;
    }
    await db
      .update(proposals)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(proposals.id, proposalId));
    revalidatePath(`/proposals/${proposalId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "saveProposalContent");
  }
}

/** Las propuestas sí se eliminan (a diferencia de clientes/proyectos). */
export async function deleteProposal(id: string): Promise<ActionResult> {
  try {
    await requireUser();
    const proposalId = proposalIdSchema.parse(id);
    await db.delete(proposals).where(eq(proposals.id, proposalId));
    revalidatePath("/proposals");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "deleteProposal");
  }
}
