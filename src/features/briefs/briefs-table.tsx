"use client";

import Link from "next/link";
import { DataPagination } from "@/components/shared/data-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  MobileDetailsCard,
  MobileField,
} from "@/components/shared/mobile-details-card";
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
      <div className="space-y-2 md:hidden">
        {pagination.pageItems.map((row) => (
          <MobileDetailsCard
            key={row.projectId}
            title={row.name}
            subtitle={row.clientName}
            badge={
              row.briefStatus ? (
                <StatusBadge value={row.briefStatus} size="xs" />
              ) : (
                <span className="text-muted-foreground text-xs">Sin brief</span>
              )
            }
            actions={
              <Link
                href={`/briefs/${row.projectId}`}
                className="hover:bg-accent inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium"
              >
                Abrir brief
              </Link>
            }
          >
            <dl>
              <MobileField label="Área">{row.area}</MobileField>
            </dl>
          </MobileDetailsCard>
        ))}
      </div>
      <div className="border-border bg-card hidden overflow-hidden rounded-xl border md:block">
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
