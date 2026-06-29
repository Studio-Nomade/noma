import { requireUser } from "@/lib/auth";
import { buildProposalPdfData } from "@/features/proposals/build-pdf-data";
import { renderProposalPdf } from "@/features/proposals/proposal-pdf";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  const bundle = await buildProposalPdfData(id);
  if (!bundle) return new Response("No encontrado", { status: 404 });

  const pdf = await renderProposalPdf(bundle.data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(bundle.filename)}"`,
    },
  });
}
