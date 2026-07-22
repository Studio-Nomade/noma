import { FileSignature } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { listProposals } from "@/features/proposals/queries";
import { ProposalsTable } from "@/features/proposals/proposals-table";

export const metadata = { title: "Propuestas" };

export default async function ProposalsPage() {
  const proposals = await listProposals();

  return (
    <>
      <PageHeader
        title="Propuestas"
        description={`${proposals.length} ${proposals.length === 1 ? "cotización" : "cotizaciones"}`}
      />

      {proposals.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="Aún no hay cotizaciones"
          description="Crea una cotización desde el detalle de un proyecto."
        />
      ) : (
        <ProposalsTable proposals={proposals} />
      )}
    </>
  );
}
