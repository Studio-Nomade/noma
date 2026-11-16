import Link from "next/link";
import { BookOpen, FileSignature } from "lucide-react";
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
        action={
          <Link
            href="/proposals/memoria"
            className="border-border hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
          >
            <BookOpen className="size-4" />
            Memoria del cotizador
          </Link>
        }
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
