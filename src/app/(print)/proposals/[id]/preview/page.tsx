import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { buildProposalPdfData } from "@/features/proposals/build-pdf-data";
import { ProposalDeck } from "@/features/proposals/templates/components/proposal-deck";

export const metadata = { title: "Vista previa" };

export default async function ProposalPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await buildProposalPdfData(id);
  if (!bundle) notFound();

  return (
    <>
      <style>{`
      @media print {
        @page { size: 16in 9in; margin: 0; }
        html, body { background: #fff !important; }
        .no-print { display: none !important; }
        .proposal-deck { gap: 0 !important; }
        .proposal-slide { width: 16in !important; height: 9in !important; max-width: none !important; box-shadow: none !important; break-after: page; page-break-after: always; }
      }
    `}</style>
      <div className="no-print border-border bg-card sticky top-0 z-20 flex items-center justify-between border-b px-6 py-3">
        <Link
          href={`/proposals/${id}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="size-4" />
          Volver al editor
        </Link>
        <a
          href={`/proposals/${id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-foreground text-background inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
        >
          <Download className="size-4" />
          Exportar PDF
        </a>
      </div>
      <main className="bg-[#d8d8d5] p-6">
        <ProposalDeck data={bundle.data} />
      </main>
    </>
  );
}
