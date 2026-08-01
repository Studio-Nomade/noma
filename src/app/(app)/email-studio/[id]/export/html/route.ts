import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { compileEmailDocument } from "@/features/email-studio/compiler.server";
import { emailDocumentSchema } from "@/features/email-studio/document";
import { isEmailStudioDocumentCurrent } from "@/features/email-studio/freshness";
import { getEmailStudioProject } from "@/features/email-studio/project-queries";
import { emailStudioProjectIdSchema } from "@/features/email-studio/project-schema";

function safeFilename(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "email"
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const parsedId = emailStudioProjectIdSchema.safeParse((await params).id);
  if (!parsedId.success) {
    return new Response("Proyecto inválido.", { status: 400 });
  }
  const project = await getEmailStudioProject(parsedId.data);
  if (!project) return new Response("No encontrado.", { status: 404 });
  if (!isEmailStudioDocumentCurrent(project)) {
    return new Response(
      "Hay cambios pendientes. Vuelve a generar el correo antes de exportarlo.",
      { status: 409 },
    );
  }
  const document = emailDocumentSchema.safeParse(project.currentDocument);
  if (!document.success) {
    return new Response("Genera el correo antes de exportarlo.", {
      status: 409,
    });
  }
  const compiled = await compileEmailDocument(document.data, {
    assetBaseUrl: request.nextUrl.origin,
  });
  const filename = `${safeFilename(project.name)}.html`;
  return new Response(compiled.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
