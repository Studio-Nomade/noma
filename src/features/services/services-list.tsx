"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { DataPagination } from "@/components/shared/data-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoneyRange } from "@/lib/currency/format";
import { AREAS, AREA_LABELS, type Area } from "@/types/enums";
import type { Service } from "@/db/schema";
import { ServiceDialog } from "./service-dialog";

function ServiceCard({ service }: { service: Service }) {
  return (
    <ServiceDialog
      service={service}
      trigger={
        <button
          type="button"
          className="border-border bg-card hover:border-foreground/20 flex flex-col rounded-xl border p-4 text-left transition-colors"
        >
          <div className="flex w-full items-start justify-between gap-2">
            <span className="font-medium">{service.name}</span>
            <StatusBadge value={service.status} size="xs" />
          </div>
          {service.description && (
            <span className="text-muted-foreground mt-1 line-clamp-2 text-sm">
              {service.description}
            </span>
          )}
          <span className="mt-3 text-sm font-medium">
            {formatMoneyRange(
              service.priceMinAmount,
              service.priceMaxAmount,
              service.priceCurrency ?? "UF",
            )}
            {service.unit && (
              <span className="text-muted-foreground font-normal">
                {" · "}
                {service.unit}
              </span>
            )}
          </span>
          {service.estimatedTime && (
            <span className="text-muted-foreground text-xs">
              {service.estimatedTime}
            </span>
          )}
        </button>
      }
    />
  );
}

export function ServicesList({ services }: { services: Service[] }) {
  const [area, setArea] = useState<Area | "all">("all");

  const presentAreas = AREAS.filter((a) => services.some((s) => s.area === a));
  const visible = useMemo(
    () => (area === "all" ? services : services.filter((s) => s.area === area)),
    [area, services],
  );
  const pagination = usePagination(visible, "noma:services:page-size", area);
  const pageServices = pagination.pageItems;
  const groups = presentAreas.filter((a) => area === "all" || a === area);

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip active={area === "all"} onClick={() => setArea("all")}>
          Todos
        </FilterChip>
        {presentAreas.map((a) => (
          <FilterChip key={a} active={area === a} onClick={() => setArea(a)}>
            {a}
          </FilterChip>
        ))}
      </div>

      <div className="space-y-8">
        {groups.map((a) => {
          const items = pageServices.filter((s) => s.area === a);
          if (items.length === 0) return null;
          // subáreas en orden de aparición; los sin subárea van al final
          const subareas = [
            ...new Set(items.map((s) => s.subarea).filter(Boolean)),
          ] as string[];
          const noSub = items.filter((s) => !s.subarea);
          return (
            <section key={a}>
              <h2 className="mb-4 text-sm font-medium tracking-wide">
                {a} · {AREA_LABELS[a]}
                <span className="text-muted-foreground"> · {items.length}</span>
              </h2>
              <div className="space-y-6">
                {subareas.map((sub) => (
                  <div key={sub}>
                    <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                      {sub}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items
                        .filter((s) => s.subarea === sub)
                        .map((s) => (
                          <ServiceCard key={s.id} service={s} />
                        ))}
                    </div>
                  </div>
                ))}
                {noSub.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {noSub.map((s) => (
                      <ServiceCard key={s.id} service={s} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <DataPagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-sm transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-accent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
