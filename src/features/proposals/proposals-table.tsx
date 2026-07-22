"use client";

import Link from "next/link";
import { DataPagination } from "@/components/shared/data-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePagination } from "@/hooks/use-pagination";
import { formatMoney } from "@/lib/currency/format";
import { ProposalDeleteButton } from "./proposal-delete-button";
import type { listProposals } from "./queries";

type ProposalRow = Awaited<ReturnType<typeof listProposals>>[number];

export function ProposalsTable({ proposals }: { proposals: ProposalRow[] }) {
  const pagination = usePagination(proposals, "noma:proposals:page-size");
  return (
    <>
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Propuesta", "Cliente", "Valor", "Estado", ""].map(
                (heading) => (
                  <TableHead
                    key={heading}
                    className="text-xs tracking-wide uppercase"
                  >
                    {heading}
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.pageItems.map((proposal) => (
              <TableRow key={proposal.id} className="hover:bg-accent/50">
                <TableCell>
                  <Link href={`/proposals/${proposal.id}`} className="block">
                    <span className="font-medium">{proposal.title}</span>
                    <span className="text-muted-foreground block text-xs">
                      {proposal.projectName} · v{proposal.version}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {proposal.clientName ?? "—"}
                </TableCell>
                <TableCell>
                  {formatMoney(
                    proposal.estimatedValueAmount,
                    proposal.estimatedValueCurrency ?? "UF",
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge value={proposal.status} size="xs" />
                </TableCell>
                <TableCell className="text-right">
                  <ProposalDeleteButton id={proposal.id} compact />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <DataPagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </>
  );
}
