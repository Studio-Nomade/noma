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
import type { listProjectsWithBrief } from "./queries";

type BriefRow = Awaited<ReturnType<typeof listProjectsWithBrief>>[number];

export function BriefsTable({ rows }: { rows: BriefRow[] }) {
  const pagination = usePagination(rows, "noma:briefs:page-size");
  return (
    <>
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Proyecto", "Cliente", "Área", "Brief"].map((heading) => (
                <TableHead
                  key={heading}
                  className="text-xs tracking-wide uppercase"
                >
                  {heading}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.pageItems.map((row) => (
              <TableRow key={row.projectId} className="hover:bg-accent/50">
                <TableCell>
                  <Link
                    href={`/briefs/${row.projectId}`}
                    className="font-medium"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.clientName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.area}
                </TableCell>
                <TableCell>
                  {row.briefStatus ? (
                    <StatusBadge value={row.briefStatus} size="xs" />
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      Sin brief
                    </span>
                  )}
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
