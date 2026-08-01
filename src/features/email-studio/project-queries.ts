import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  emailStudioAssets,
  emailStudioElements,
  emailStudioProjects,
  emailStudioRevisions,
  emailStudioTemplates,
  emailStudioVariables,
  projects,
} from "@/db/schema";
import { EMAIL_STUDIO_SOURCES_BUCKET, signedUrl } from "@/lib/supabase/storage";

export async function listEmailStudioProjects() {
  return db
    .select({
      id: emailStudioProjects.id,
      name: emailStudioProjects.name,
      description: emailStudioProjects.description,
      status: emailStudioProjects.status,
      currentDocumentVersion: emailStudioProjects.currentDocumentVersion,
      generationMode: emailStudioProjects.generationMode,
      clientId: emailStudioProjects.clientId,
      clientName: clients.companyName,
      nomaProjectId: emailStudioProjects.nomaProjectId,
      nomaProjectName: projects.name,
      createdAt: emailStudioProjects.createdAt,
      updatedAt: emailStudioProjects.updatedAt,
    })
    .from(emailStudioProjects)
    .innerJoin(clients, eq(emailStudioProjects.clientId, clients.id))
    .leftJoin(projects, eq(emailStudioProjects.nomaProjectId, projects.id))
    .orderBy(desc(emailStudioProjects.updatedAt));
}

export type EmailStudioProjectListItem = Awaited<
  ReturnType<typeof listEmailStudioProjects>
>[number];

export async function getEmailStudioProject(id: string) {
  const [row] = await db
    .select({
      id: emailStudioProjects.id,
      name: emailStudioProjects.name,
      description: emailStudioProjects.description,
      status: emailStudioProjects.status,
      currentDocument: emailStudioProjects.currentDocument,
      currentDocumentVersion: emailStudioProjects.currentDocumentVersion,
      subject: emailStudioProjects.subject,
      previewText: emailStudioProjects.previewText,
      emailWidth: emailStudioProjects.emailWidth,
      canvasColor: emailStudioProjects.canvasColor,
      bodyColor: emailStudioProjects.bodyColor,
      textColor: emailStudioProjects.textColor,
      generationMode: emailStudioProjects.generationMode,
      generatedAt: emailStudioProjects.generatedAt,
      clientId: emailStudioProjects.clientId,
      clientName: clients.companyName,
      nomaProjectId: emailStudioProjects.nomaProjectId,
      nomaProjectName: projects.name,
      createdAt: emailStudioProjects.createdAt,
      updatedAt: emailStudioProjects.updatedAt,
      createdBy: emailStudioProjects.createdBy,
    })
    .from(emailStudioProjects)
    .innerJoin(clients, eq(emailStudioProjects.clientId, clients.id))
    .leftJoin(projects, eq(emailStudioProjects.nomaProjectId, projects.id))
    .where(eq(emailStudioProjects.id, id))
    .limit(1);

  return row ?? null;
}

export async function listEmailStudioProjectOptions() {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      clientId: projects.clientId,
    })
    .from(projects)
    .orderBy(asc(projects.name));
}

export async function getEmailStudioWorkspace(projectId: string) {
  const project = await getEmailStudioProject(projectId);
  if (!project) return null;

  const [assets, elements, variables, templates, revisions] = await Promise.all(
    [
      db
        .select()
        .from(emailStudioAssets)
        .where(
          and(
            eq(emailStudioAssets.projectId, projectId),
            eq(emailStudioAssets.status, "active"),
          ),
        )
        .orderBy(asc(emailStudioAssets.createdAt)),
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
      db
        .select({
          id: emailStudioTemplates.id,
          clientId: emailStudioTemplates.clientId,
          sourceProjectId: emailStudioTemplates.sourceProjectId,
          assetId: emailStudioTemplates.assetId,
          name: emailStudioTemplates.name,
          description: emailStudioTemplates.description,
          alt: emailStudioTemplates.alt,
          href: emailStudioTemplates.href,
          status: emailStudioTemplates.status,
          createdAt: emailStudioTemplates.createdAt,
          updatedAt: emailStudioTemplates.updatedAt,
          assetLabel: emailStudioAssets.label,
          assetUrl: emailStudioAssets.publicUrl,
          assetWidth: emailStudioAssets.width,
        })
        .from(emailStudioTemplates)
        .innerJoin(
          emailStudioAssets,
          eq(emailStudioTemplates.assetId, emailStudioAssets.id),
        )
        .where(eq(emailStudioTemplates.clientId, project.clientId))
        .orderBy(desc(emailStudioTemplates.updatedAt)),
      db
        .select({
          id: emailStudioRevisions.id,
          kind: emailStudioRevisions.kind,
          label: emailStudioRevisions.label,
          documentVersion: emailStudioRevisions.documentVersion,
          generationMode: emailStudioRevisions.generationMode,
          createdAt: emailStudioRevisions.createdAt,
        })
        .from(emailStudioRevisions)
        .where(eq(emailStudioRevisions.projectId, projectId))
        .orderBy(desc(emailStudioRevisions.createdAt))
        .limit(12),
    ],
  );

  const reference = assets.find((asset) => asset.role === "reference") ?? null;
  const referenceUrl = reference
    ? await signedUrl(
        EMAIL_STUDIO_SOURCES_BUCKET,
        reference.storagePath,
        60 * 60,
      )
    : null;

  return {
    project,
    assets,
    elements,
    variables,
    templates,
    revisions,
    reference,
    referenceUrl,
  };
}

export type EmailStudioWorkspaceData = NonNullable<
  Awaited<ReturnType<typeof getEmailStudioWorkspace>>
>;
