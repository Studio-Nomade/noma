import { requireUser } from "@/lib/auth";
import { getProposal } from "@/features/proposals/queries";
import { getSlaByProposal } from "@/features/sla/queries";
import { renderSlaPdf } from "@/features/sla/sla-pdf";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  const row = await getProposal(id);
  if (!row) return new Response("No encontrado", { status: 404 });
  const sla = await getSlaByProposal(id);
  if (!sla) return new Response("SLA no generado", { status: 404 });

  const created = new Date(sla.createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const code = `${String(created.getFullYear()).slice(2)}${pad(created.getMonth() + 1)}${pad(created.getDate())}`;
  const filename = `SLA_${code} | ${row.clientName ?? "Cliente"} - ${row.projectName}.pdf`;

  const pdf = await renderSlaPdf({
    title: row.proposal.title,
    clientName: row.clientName ?? "—",
    projectName: row.projectName,
    sections: sla.sections ?? [],
    signedByName: sla.signedByName,
    signedAt: sla.signedAt ? sla.signedAt.toISOString() : null,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
