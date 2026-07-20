"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

export function SortButton({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = active
    ? direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ordenar por ${label}`}
      className={cn(
        "text-muted-foreground hover:text-foreground inline-flex w-full items-center gap-1.5 text-xs font-medium tracking-wide uppercase transition-colors",
        align === "right" && "justify-end",
      )}
    >
      {label}
      <Icon className={cn("size-3", !active && "opacity-40")} />
    </button>
  );
}
