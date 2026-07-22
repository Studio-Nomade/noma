"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataPagination } from "./data-pagination";

export function UrlPagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(nextPage: number, nextPageSize = pageSize) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextPageSize));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <DataPagination
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={(next) => navigate(next)}
      onPageSizeChange={(next) => navigate(1, next)}
    />
  );
}
