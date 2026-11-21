import { requireUser } from "@/lib/auth";
import { buildSlaPdfData } from "@/features/sla/build-pdf-data";
import { renderSlaPdf } from "@/features/sla/sla-pdf";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  const bundle = await buildSlaPdfData(id);
  if (!bundle) return new Response("SLA no generado", { status: 404 });

  const pdf = await renderSlaPdf(bundle.data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(bundle.filename)}"`,
    },
  });
}
