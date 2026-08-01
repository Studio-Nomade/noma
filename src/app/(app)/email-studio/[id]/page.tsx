import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import {
  auditCompiledEmail,
  compileEmailDocument,
} from "@/features/email-studio/compiler.server";
import { emailDocumentSchema } from "@/features/email-studio/document";
import { emailStudioProjectIdSchema } from "@/features/email-studio/project-schema";
import { EmailStudioProjectStatusButton } from "@/features/email-studio/project-status-button";
import { getEmailStudioWorkspace } from "@/features/email-studio/project-queries";
import { EmailStudioWorkspace } from "@/features/email-studio/studio-workspace";

export const metadata = { title: "Proyecto · Email Studio" };

async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${protocol}://${host}` : "http://localhost:3001";
}

export default async function EmailStudioProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const parsedId = emailStudioProjectIdSchema.safeParse((await params).id);
  if (!parsedId.success) notFound();

  const workspace = await getEmailStudioWorkspace(parsedId.data);
  if (!workspace) notFound();
  const project = workspace.project;
  const document = emailDocumentSchema.safeParse(project.currentDocument);
  const compiledDocument = document.success
    ? await compileEmailDocument(document.data, {
        assetBaseUrl: await requestOrigin(),
      })
    : null;
  const compiled = compiledDocument
    ? {
        html: compiledDocument.html,
        mjml: compiledDocument.mjml,
        warnings: compiledDocument.warnings,
        audit: auditCompiledEmail(compiledDocument),
      }
    : null;

  return (
    <>
      <div className="mb-3">
        <Button
          render={<Link href="/email-studio" />}
          nativeButton={false}
          variant="ghost"
          size="sm"
        >
          <ArrowLeft />
          Todos los proyectos
        </Button>
      </div>
      <PageHeader
        title={project.name}
        description={
          project.description ??
          "Espacio de trabajo para preparar el diseño y generar su HTML."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{project.clientName}</Badge>
            <Badge
              variant={project.status === "archived" ? "outline" : "secondary"}
            >
              {project.status === "archived" ? "Archivado" : "Activo"}
            </Badge>
            <EmailStudioProjectStatusButton
              id={project.id}
              status={project.status as "active" | "archived"}
              compact
            />
          </div>
        }
      />
      <EmailStudioWorkspace workspace={workspace} compiled={compiled} />
    </>
  );
}
