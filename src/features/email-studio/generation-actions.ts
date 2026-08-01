"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, asc, count, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  emailStudioAssets,
  emailStudioAiRuns,
  emailStudioElements,
  emailStudioProjects,
  emailStudioRevisions,
  emailStudioVariables,
} from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { EMAIL_STUDIO_SOURCES_BUCKET, signedUrl } from "@/lib/supabase/storage";
import { buildEmailDocument } from "./document-builder";
import { compileEmailDocument } from "./compiler.server";
import { emailDocumentSchema } from "./document";
import { emailStudioHrefSchema, emailStudioIdSchema } from "./editor-schema";
import { generateEmailPlanWithOpenAI } from "./generation.server";
import type { EmailStudioGenerationPlan } from "./generation-plan";
import {
  createEmailStudioEditorSnapshot,
  emailStudioEditorSnapshotSchema,
} from "./revision-state";

type GenerationMode = "ai" | "manual";

function aiModel(): string {
  return process.env.EMAIL_STUDIO_OPENAI_MODEL?.trim() || "gpt-5.6";
}

function aiHourlyLimit(): number {
  const parsed = Number(process.env.EMAIL_STUDIO_AI_MAX_RUNS_PER_HOUR ?? "10");
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 10;
}

class AiRateLimitError extends Error {}

async function startAiRun(input: {
  projectId: string;
  userId: string;
  assetCount: number;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`email-studio-ai:${input.userId}`}))`,
    );
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [{ value }] = await tx
      .select({ value: count() })
      .from(emailStudioAiRuns)
      .where(
        and(
          eq(emailStudioAiRuns.createdBy, input.userId),
          gte(emailStudioAiRuns.createdAt, since),
        ),
      );
    if (value >= aiHourlyLimit()) {
      throw new AiRateLimitError("Límite horario de generación asistida.");
    }
    const [run] = await tx
      .insert(emailStudioAiRuns)
      .values({
        projectId: input.projectId,
        status: "running",
        model: aiModel(),
        assetCount: input.assetCount,
        createdBy: input.userId,
      })
      .returning({ id: emailStudioAiRuns.id });
    return run.id;
  });
}

function aiFailureCode(error: unknown): string {
  if (error instanceof AiRateLimitError) return "local_rate_limit";
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    if (status === 429) return "provider_rate_limit";
    if (status >= 500) return "provider_unavailable";
    if (status >= 400) return "provider_request";
  }
  return "generation_failed";
}

function safeHref(value: string | null): string | null {
  if (!value) return null;
  const parsed = emailStudioHrefSchema.safeParse(value);
  return parsed.success && parsed.data ? parsed.data : null;
}

function normalizedPlanElements(
  plan: EmailStudioGenerationPlan,
  validAssetIds: Set<string>,
) {
  return plan.elements
    .map((element, position) => {
      if (
        element.type === "image" &&
        (!element.assetId || !validAssetIds.has(element.assetId))
      ) {
        return null;
      }
      if (element.type === "button" && !safeHref(element.href)) {
        return null;
      }
      return {
        type: element.type,
        position,
        assetId: element.type === "image" ? element.assetId : null,
        label: element.label,
        content:
          element.type === "spacer"
            ? String(element.spacerHeight ?? 24)
            : element.content,
        href: safeHref(element.href),
        alt: element.alt ?? element.label,
        align: element.align,
        fontSize: element.fontSize,
        color: element.color,
        backgroundColor: element.backgroundColor,
        padding: element.type === "image" ? "0px" : "16px 32px",
      };
    })
    .filter((element): element is NonNullable<typeof element> =>
      Boolean(element),
    );
}

function editorStateFromPlan(
  plan: EmailStudioGenerationPlan,
  validAssetIds: Set<string>,
) {
  const elements = normalizedPlanElements(plan, validAssetIds).map(
    (element) => ({
      id: randomUUID(),
      templateId: null,
      ...element,
    }),
  );
  if (elements.length === 0) {
    throw new Error("El plan asistido no contiene elementos utilizables.");
  }
  const variables = [
    ...new Map(
      plan.variables.map((variable) => [variable.key, variable]),
    ).values(),
  ].map((variable) => ({ id: randomUUID(), ...variable }));
  return { elements, variables };
}

async function loadBuilderInput(projectId: string) {
  const [project] = await db
    .select()
    .from(emailStudioProjects)
    .where(eq(emailStudioProjects.id, projectId))
    .limit(1);
  if (!project) return null;

  const [elementRows, variableRows] = await Promise.all([
    db
      .select()
      .from(emailStudioElements)
      .where(eq(emailStudioElements.projectId, projectId))
      .orderBy(asc(emailStudioElements.position)),
    db
      .select()
      .from(emailStudioVariables)
      .where(eq(emailStudioVariables.projectId, projectId))
      .orderBy(asc(emailStudioVariables.createdAt)),
  ]);
  const elements = elementRows.map((element) => ({
    id: element.id,
    type: element.type,
    position: element.position,
    assetId: element.assetId,
    templateId: element.templateId,
    label: element.label,
    content: element.content,
    href: element.href,
    alt: element.alt,
    align: element.align,
    fontSize: element.fontSize,
    color: element.color,
    backgroundColor: element.backgroundColor,
    padding: element.padding,
  }));
  const variables = variableRows.map((variable) => ({
    id: variable.id,
    key: variable.key,
    label: variable.label,
    sample: variable.sample,
    required: variable.required,
  }));
  const assetIds = [
    ...new Set(
      elements
        .map((element) => element.assetId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const assets =
    assetIds.length > 0
      ? await db
          .select()
          .from(emailStudioAssets)
          .where(inArray(emailStudioAssets.id, assetIds))
      : [];

  return { project, elements, variables, assets };
}

async function buildValidatedDocument(
  input: NonNullable<Awaited<ReturnType<typeof loadBuilderInput>>>,
) {
  const document = emailDocumentSchema.parse(
    buildEmailDocument({
      project: input.project,
      assets: input.assets,
      elements: input.elements,
      variables: input.variables,
    }),
  );
  // La generación solo se persiste si también supera el compilador real.
  await compileEmailDocument(document, {
    assetBaseUrl: "https://noma.invalid",
  });
  return document;
}

export async function generateEmailStudioDocument(
  projectId: string,
  useAi = true,
): Promise<
  ActionResult<{ mode: GenerationMode; version: number; warning?: string }>
> {
  try {
    const user = await requireUser();
    const validProjectId = emailStudioIdSchema.parse(projectId);
    const [project] = await db
      .select()
      .from(emailStudioProjects)
      .where(eq(emailStudioProjects.id, validProjectId))
      .limit(1);
    if (!project) return { ok: false, error: "Proyecto no encontrado." };
    if (project.status === "archived") {
      return {
        ok: false,
        error: "Restaura el proyecto antes de generar su correo.",
      };
    }

    const existingInput = await loadBuilderInput(validProjectId);
    if (!existingInput) return { ok: false, error: "Proyecto no encontrado." };
    const checkpoint = createEmailStudioEditorSnapshot(existingInput);

    let mode: GenerationMode = "manual";
    let warning: string | undefined;
    let candidateInput = existingInput;
    const localAssets = await db
      .select()
      .from(emailStudioAssets)
      .where(
        and(
          eq(emailStudioAssets.projectId, validProjectId),
          eq(emailStudioAssets.status, "active"),
        ),
      )
      .orderBy(asc(emailStudioAssets.createdAt));
    const reference =
      localAssets.find((asset) => asset.role === "reference") ?? null;
    const contentAssets = localAssets.filter(
      (asset) => asset.role === "asset" && asset.publicUrl,
    );

    if (useAi && process.env.OPENAI_API_KEY?.trim() && reference) {
      let aiRunId: string | null = null;
      const aiStartedAt = Date.now();
      try {
        const sentAssets = contentAssets.slice(0, 12);
        aiRunId = await startAiRun({
          projectId: validProjectId,
          userId: user.id,
          assetCount: sentAssets.length,
        });
        const referenceUrl = await signedUrl(
          EMAIL_STUDIO_SOURCES_BUCKET,
          reference.storagePath,
          60 * 15,
        );
        if (!referenceUrl) throw new Error("No se pudo leer la referencia.");
        const generated = await generateEmailPlanWithOpenAI({
          projectName: project.name,
          reference: {
            url: referenceUrl,
            mimeType: reference.mimeType,
            filename: reference.originalName,
          },
          assets: sentAssets.map((asset) => ({
            id: asset.id,
            label: asset.label,
            url: asset.publicUrl!,
          })),
        });
        const plan = generated.plan;
        const planned = editorStateFromPlan(
          plan,
          new Set(sentAssets.map((asset) => asset.id)),
        );
        candidateInput = {
          project: {
            ...existingInput.project,
            subject: plan.subject,
            previewText: plan.previewText,
          },
          elements: planned.elements,
          variables: planned.variables,
          assets: contentAssets,
        };
        await buildValidatedDocument(candidateInput);
        try {
          await db
            .update(emailStudioAiRuns)
            .set({
              status: "completed",
              model: generated.telemetry.model,
              inputTokens: generated.telemetry.inputTokens,
              outputTokens: generated.telemetry.outputTokens,
              totalTokens: generated.telemetry.totalTokens,
              durationMs: Date.now() - aiStartedAt,
              responseId: generated.telemetry.responseId,
              updatedAt: new Date(),
            })
            .where(eq(emailStudioAiRuns.id, aiRunId));
        } catch (telemetryError) {
          console.error("[email-studio:ai:telemetry]", telemetryError);
        }
        mode = "ai";
      } catch (error) {
        console.error("[email-studio:generation:fallback]", error);
        if (aiRunId) {
          try {
            await db
              .update(emailStudioAiRuns)
              .set({
                status: "failed",
                durationMs: Date.now() - aiStartedAt,
                failureCode: aiFailureCode(error),
                updatedAt: new Date(),
              })
              .where(eq(emailStudioAiRuns.id, aiRunId));
          } catch (telemetryError) {
            console.error("[email-studio:ai:telemetry]", telemetryError);
          }
        }
        warning =
          error instanceof AiRateLimitError
            ? "Se alcanzó el límite horario de asistencia; se compiló la estructura manual sin perder cambios."
            : "La generación asistida no estuvo disponible; se compiló la estructura configurada manualmente.";
      }
    } else if (useAi) {
      warning = reference
        ? "OpenAI no está configurado; se compiló la estructura configurada manualmente."
        : "Carga una referencia para usar generación asistida; se compiló la estructura configurada manualmente.";
    }

    const document = await buildValidatedDocument(candidateInput);
    const candidateSnapshot = createEmailStudioEditorSnapshot(candidateInput);
    const generatedAt = new Date();

    const updated = await db.transaction(async (tx) => {
      if (mode === "ai") {
        await tx.insert(emailStudioRevisions).values({
          projectId: validProjectId,
          kind: "checkpoint",
          label: "Antes de generación asistida",
          documentVersion: project.currentDocumentVersion,
          generationMode: project.generationMode,
          editorState: checkpoint,
          document: project.currentDocument,
          createdBy: user.id,
        });
        await tx
          .delete(emailStudioElements)
          .where(eq(emailStudioElements.projectId, validProjectId));
        await tx
          .delete(emailStudioVariables)
          .where(eq(emailStudioVariables.projectId, validProjectId));
        await tx.insert(emailStudioElements).values(
          candidateInput.elements.map((element) => ({
            ...element,
            projectId: validProjectId,
            createdBy: user.id,
          })),
        );
        if (candidateInput.variables.length > 0) {
          await tx.insert(emailStudioVariables).values(
            candidateInput.variables.map((variable) => ({
              ...variable,
              projectId: validProjectId,
              createdBy: user.id,
            })),
          );
        }
      }

      const [nextProject] = await tx
        .update(emailStudioProjects)
        .set({
          subject: candidateInput.project.subject,
          previewText: candidateInput.project.previewText,
          currentDocument: document,
          currentDocumentVersion: sql`${emailStudioProjects.currentDocumentVersion} + 1`,
          generationMode: mode,
          generatedAt,
          updatedAt: generatedAt,
        })
        .where(eq(emailStudioProjects.id, validProjectId))
        .returning({ version: emailStudioProjects.currentDocumentVersion });

      await tx.insert(emailStudioRevisions).values({
        projectId: validProjectId,
        kind: "generated",
        label: mode === "ai" ? "Generación asistida" : "Compilación manual",
        documentVersion: nextProject.version,
        generationMode: mode,
        editorState: candidateSnapshot,
        document,
        createdBy: user.id,
      });
      return nextProject;
    });

    revalidatePath(`/email-studio/${validProjectId}`);
    revalidatePath("/email-studio");
    return {
      ok: true,
      data: { mode, version: updated.version, ...(warning ? { warning } : {}) },
    };
  } catch (error) {
    return handleActionError(error, "generateEmailStudioDocument");
  }
}

export async function restoreEmailStudioRevision(
  projectId: string,
  revisionId: string,
): Promise<ActionResult<{ version: number }>> {
  try {
    const user = await requireUser();
    const validProjectId = emailStudioIdSchema.parse(projectId);
    const validRevisionId = emailStudioIdSchema.parse(revisionId);
    const existingInput = await loadBuilderInput(validProjectId);
    if (!existingInput) return { ok: false, error: "Proyecto no encontrado." };
    if (existingInput.project.status !== "active") {
      return {
        ok: false,
        error: "Restaura el proyecto antes de recuperar una revisión.",
      };
    }
    const [revision] = await db
      .select()
      .from(emailStudioRevisions)
      .where(
        and(
          eq(emailStudioRevisions.id, validRevisionId),
          eq(emailStudioRevisions.projectId, validProjectId),
        ),
      )
      .limit(1);
    if (!revision) return { ok: false, error: "Revisión no encontrada." };

    const snapshot = emailStudioEditorSnapshotSchema.parse(
      revision.editorState,
    );
    const assetIds = [
      ...new Set(
        snapshot.elements
          .map((element) => element.assetId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const assets =
      assetIds.length > 0
        ? await db
            .select()
            .from(emailStudioAssets)
            .where(inArray(emailStudioAssets.id, assetIds))
        : [];
    if (assets.length !== assetIds.length) {
      return {
        ok: false,
        error: "La revisión depende de assets que ya no están disponibles.",
      };
    }
    const candidateInput = {
      project: { ...existingInput.project, ...snapshot.settings },
      elements: snapshot.elements,
      variables: snapshot.variables,
      assets,
    };
    const storedDocument = emailDocumentSchema.safeParse(revision.document);
    const restoredMode: GenerationMode =
      revision.generationMode === "ai" ? "ai" : "manual";
    const document = storedDocument.success
      ? storedDocument.data
      : await buildValidatedDocument(candidateInput);
    await compileEmailDocument(document, {
      assetBaseUrl: "https://noma.invalid",
    });
    const currentCheckpoint = createEmailStudioEditorSnapshot(existingInput);
    const restoredAt = new Date();

    const restored = await db.transaction(async (tx) => {
      await tx.insert(emailStudioRevisions).values({
        projectId: validProjectId,
        kind: "checkpoint",
        label: "Antes de recuperar revisión",
        documentVersion: existingInput.project.currentDocumentVersion,
        generationMode: existingInput.project.generationMode,
        editorState: currentCheckpoint,
        document: existingInput.project.currentDocument,
        createdBy: user.id,
      });
      await tx
        .delete(emailStudioElements)
        .where(eq(emailStudioElements.projectId, validProjectId));
      await tx
        .delete(emailStudioVariables)
        .where(eq(emailStudioVariables.projectId, validProjectId));
      if (assetIds.length > 0) {
        await tx
          .update(emailStudioAssets)
          .set({ status: "active", updatedAt: restoredAt })
          .where(inArray(emailStudioAssets.id, assetIds));
      }
      if (snapshot.elements.length > 0) {
        await tx.insert(emailStudioElements).values(
          snapshot.elements.map((element) => ({
            ...element,
            projectId: validProjectId,
            createdBy: user.id,
          })),
        );
      }
      if (snapshot.variables.length > 0) {
        await tx.insert(emailStudioVariables).values(
          snapshot.variables.map((variable) => ({
            ...variable,
            projectId: validProjectId,
            createdBy: user.id,
          })),
        );
      }
      const [nextProject] = await tx
        .update(emailStudioProjects)
        .set({
          ...snapshot.settings,
          currentDocument: document,
          currentDocumentVersion: sql`${emailStudioProjects.currentDocumentVersion} + 1`,
          generationMode: restoredMode,
          generatedAt: restoredAt,
          updatedAt: restoredAt,
        })
        .where(eq(emailStudioProjects.id, validProjectId))
        .returning({ version: emailStudioProjects.currentDocumentVersion });
      await tx.insert(emailStudioRevisions).values({
        projectId: validProjectId,
        kind: "restored",
        label: `Recuperada: ${revision.label}`,
        documentVersion: nextProject.version,
        generationMode: restoredMode,
        editorState: snapshot,
        document,
        createdBy: user.id,
      });
      return nextProject;
    });

    revalidatePath(`/email-studio/${validProjectId}`);
    revalidatePath("/email-studio");
    return { ok: true, data: { version: restored.version } };
  } catch (error) {
    return handleActionError(error, "restoreEmailStudioRevision");
  }
}
