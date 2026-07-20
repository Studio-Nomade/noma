import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, cfoRequests, projects } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { getSugeridos } from "@/features/finance/cobranza/queries";

type AutomationActor = {
  id: string;
  email?: string | null;
};

type CfoRequestInput = {
  projectId: string;
  actor: AutomationActor;
};

type CollectionSuggestionInput = {
  projectId: string;
  invoiceId?: string | null;
  actor: AutomationActor;
};

/**
 * Crea una única solicitud CFO al aprobar una oportunidad. El advisory lock
 * evita duplicados incluso si dos acciones llegan en paralelo.
 */
export async function ensureCfoRequestForApprovedProject({
  projectId,
  actor,
}: CfoRequestInput): Promise<{ created: boolean }> {
  try {
    const created = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`noma:cfo:${projectId}`}))`,
      );

      const [project] = await tx
        .select({ clientId: projects.clientId })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      if (!project) return false;

      const [existing] = await tx
        .select({ id: cfoRequests.id })
        .from(cfoRequests)
        .where(eq(cfoRequests.projectId, projectId))
        .limit(1);
      if (existing) return false;

      await tx.insert(cfoRequests).values({
        projectId,
        clientId: project.clientId,
        status: "Pendiente",
        notes: "Generada automáticamente al aprobar la oportunidad.",
        requestedBy: actor.id,
        requestedByEmail: actor.email ?? null,
        createdBy: actor.id,
      });
      return true;
    });

    if (created) {
      await logActivity({
        entityType: "project",
        entityId: projectId,
        action: "cfo_request_auto_created",
        actorId: actor.id,
      });
    }
    return { created };
  } catch (error) {
    console.error("[automation:ensureCfoRequestForApprovedProject]", error);
    return { created: false };
  }
}

/**
 * Registra una sugerencia de cobranza derivada por `getSugeridos`. No crea un
 * mensaje ni envía correo: la persona de Finanzas conserva el control del envío.
 */
export async function ensureCollectionSuggestion({
  projectId,
  invoiceId,
  actor,
}: CollectionSuggestionInput): Promise<{ created: boolean }> {
  try {
    const suggestion = (await getSugeridos(projectId))[0];
    if (!suggestion) return { created: false };

    const suggestionKey = invoiceId ?? "sin-factura";
    const action = `collection_suggested:${suggestion.moment}:${suggestionKey}`;
    const created = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`noma:collection:${projectId}:${suggestionKey}`}))`,
      );
      const [existing] = await tx
        .select({ id: activityLog.id })
        .from(activityLog)
        .where(
          and(
            eq(activityLog.entityId, projectId),
            eq(activityLog.action, action),
          ),
        )
        .limit(1);
      if (existing) return false;

      await logActivity(
        {
          entityType: "cobranza_message",
          entityId: projectId,
          action,
          actorId: actor.id,
        },
        tx,
      );
      return true;
    });

    return { created };
  } catch (error) {
    console.error("[automation:ensureCollectionSuggestion]", error);
    return { created: false };
  }
}

/** Reglas seguras que se ejecutan al mover la etapa comercial a Aprobado. */
export async function runApprovedStageAutomations(input: CfoRequestInput) {
  const [cfo, collection] = await Promise.all([
    ensureCfoRequestForApprovedProject(input),
    ensureCollectionSuggestion(input),
  ]);
  return { cfo, collection };
}
