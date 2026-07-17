import Link from "next/link";
import { FileSignature } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/currency/format";
import { listProposals } from "@/features/proposals/queries";
import { ProposalDeleteButton } from "@/features/proposals/proposal-delete-button";

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
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Propuesta", "Cliente", "Valor", "Estado", ""].map((h) => (
                  <TableHead
                    key={h}
                    className="text-xs tracking-wide uppercase"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map((p) => (
                <TableRow key={p.id} className="hover:bg-accent/50">
                  <TableCell>
                    <Link href={`/proposals/${p.id}`} className="block">
                      <span className="font-medium">{p.title}</span>
                      <span className="text-muted-foreground block text-xs">
                        {p.projectName} · v{p.version}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.clientName ?? "—"}
                  </TableCell>
                  <TableCell>
                    {formatMoney(
                      p.estimatedValueAmount,
                      p.estimatedValueCurrency ?? "UF",
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={p.status} size="xs" />
                  </TableCell>
                  <TableCell className="text-right">
                    <ProposalDeleteButton id={p.id} compact />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
