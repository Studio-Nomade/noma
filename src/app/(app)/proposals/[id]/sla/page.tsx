import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProposal } from "@/features/proposals/queries";
import { getSlaByProposal } from "@/features/sla/queries";
import { SlaEditor } from "@/features/sla/sla-editor";

export const metadata = { title: "SLA" };

export default async function SlaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getProposal(id);
  if (!row) notFound();
  const { proposal, clientName, projectName } = row;

  const sla = await getSlaByProposal(id);

  return (
    <>
      <Link
        href={`/proposals/${id}`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Volver a la propuesta
      </Link>

      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          SLA · {proposal.title}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {clientName ?? "—"} · {projectName}
        </p>
      </div>

      {proposal.status !== "Aprobada" ? (
        <div className="border-border bg-accent/40 rounded-xl border p-6 text-sm">
          El SLA se genera cuando la propuesta está <strong>Aprobada</strong>.
          Estado actual: <strong>{proposal.status}</strong>.
        </div>
      ) : (
        <div className="border-border bg-card rounded-xl border p-6">
          <SlaEditor proposalId={id} sla={sla} />
        </div>
      )}
    </>
  );
}
