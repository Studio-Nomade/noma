import { requireUser } from "@/lib/auth";
import { emailDocumentSchema } from "@/features/email-studio/document";
import { isEmailStudioDocumentCurrent } from "@/features/email-studio/freshness";
import { getEmailStudioProject } from "@/features/email-studio/project-queries";
import { emailStudioProjectIdSchema } from "@/features/email-studio/project-schema";

export async function GET(
  _request: Request,
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
  return new Response(JSON.stringify(document.data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="email-blueprint.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
