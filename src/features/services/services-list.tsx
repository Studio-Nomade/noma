"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataPagination } from "@/components/shared/data-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import { formatMoneyRange } from "@/lib/currency/format";
import { AREAS, AREA_LABELS, type Area } from "@/types/enums";
import type { Rates } from "@/lib/currency/convert";
import type { Service } from "@/db/schema";
import { ServiceDialog } from "./service-dialog";

function ServiceCard({
  service,
  rates,
  subareasByArea,
}: {
  service: Service;
  rates?: Rates;
  subareasByArea: Record<string, string[]>;
}) {
  return (
    <ServiceDialog
      service={service}
      rates={rates}
      subareasByArea={subareasByArea}
      trigger={
        <button
          type="button"
          className="glass hover-lift flex flex-col rounded-xl p-4 text-left"
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

export function ServicesList({
  services,
  rates,
  subareasByArea,
}: {
  services: Service[];
  rates?: Rates;
  subareasByArea: Record<string, string[]>;
}) {
  const [area, setArea] = useState<Area | "all">("all");
  const [query, setQuery] = useState("");

  const presentAreas = AREAS.filter((a) => services.some((s) => s.area === a));
  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return services.filter((s) => {
      if (area !== "all" && s.area !== area) return false;
      if (!q) return true;
      return [s.name, s.subarea, s.description]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [area, query, services]);
  const pagination = usePagination(
    visible,
    "noma:services:page-size",
    `${area}:${query}`,
  );
  const pageServices = pagination.pageItems;
  const groups = presentAreas.filter((a) => area === "all" || a === area);

  return (
    <div>
      <div className="relative mb-4">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          placeholder="Buscar servicio por nombre, subárea o descripción…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
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

      {visible.length === 0 && (
        <p className="text-muted-foreground py-12 text-center text-sm">
          Sin servicios que coincidan con la búsqueda.
        </p>
      )}

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
                          <ServiceCard
                            key={s.id}
                            service={s}
                            rates={rates}
                            subareasByArea={subareasByArea}
                          />
                        ))}
                    </div>
                  </div>
                ))}
                {noSub.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {noSub.map((s) => (
                      <ServiceCard
                        key={s.id}
                        service={s}
                        rates={rates}
                        subareasByArea={subareasByArea}
                      />
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
