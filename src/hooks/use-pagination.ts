"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 20;

export function usePagination<T>(
  items: T[],
  storageKey: string,
  resetKey: string | number = items.length,
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(storageKey));
    if ([20, 50, 100, 200].includes(stored)) setPageSizeState(stored);
  }, [storageKey]);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  function setPageSize(next: number) {
    setPageSizeState(next);
    setPage(1);
    window.localStorage.setItem(storageKey, String(next));
  }

  return {
    pageItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    totalPages,
  };
}
