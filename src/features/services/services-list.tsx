"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataPagination } from "@/components/shared/data-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoneyRange } from "@/lib/currency/format";
import { AREAS, AREA_LABELS, type Area } from "@/types/enums";
import type { ServiceSubarea } from "@/db/schema";
import type { Rates } from "@/lib/currency/convert";
import { ServiceDialog } from "./service-dialog";
import type { ServiceWithVariants } from "./queries";
import { SERVICE_TIER_META, type ServiceTier } from "./tiers";
import { Input } from "@/components/ui/input";

function CardContent({ service }: { service: ServiceWithVariants }) {
  const enabledTiers: ServiceTier[] = service.variants
    .filter((variant) => variant.enabled)
    .map((variant) => variant.tier as ServiceTier);
  const displayTiers: ServiceTier[] = enabledTiers.length
    ? enabledTiers
    : ["START"];
  return (
    <div className="flex h-full flex-col">
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
      <div className="mt-3 flex flex-wrap gap-1">
        {displayTiers.map((tier) => (
          <span
            key={tier}
            className="bg-accent text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium"
          >
            {SERVICE_TIER_META[tier].shortLabel}
          </span>
        ))}
      </div>
    </div>
  );
}

function ServiceCard({
  service,
  canEdit,
  rates,
  subareas,
}: {
  service: ServiceWithVariants;
  canEdit: boolean;
  rates: Rates;
  subareas: ServiceSubarea[];
}) {
  if (!canEdit) {
    return (
      <article className="glass flex flex-col rounded-xl p-4">
        <CardContent service={service} />
      </article>
    );
  }
  return (
    <ServiceDialog
      service={service}
      rates={rates}
      subareas={subareas}
      trigger={
        <button
          type="button"
          className="glass hover-lift flex flex-col rounded-xl p-4 text-left"
        >
          <CardContent service={service} />
        </button>
      }
    />
  );
}

export function ServicesList({
  services,
  canEdit,
  rates,
  subareas,
}: {
  services: ServiceWithVariants[];
  canEdit: boolean;
  rates: Rates;
  subareas: ServiceSubarea[];
}) {
  const [area, setArea] = useState<Area | "all">("all");
  const [subarea, setSubarea] = useState("all");
  const [query, setQuery] = useState("");

  const presentAreas = AREAS.filter((a) => services.some((s) => s.area === a));
  const availableSubareas = useMemo(
    () =>
      [
        ...new Set(
          services
            .filter((service) => area === "all" || service.area === area)
            .map((service) => service.subarea)
            .filter(Boolean),
        ),
      ] as string[],
    [area, services],
  );
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return services.filter((service) => {
      if (area !== "all" && service.area !== area) return false;
      if (subarea !== "all" && service.subarea !== subarea) return false;
      if (!normalizedQuery) return true;
      return [service.name, service.subarea, service.description]
        .filter(Boolean)
        .some((value) =>
          value!.toLocaleLowerCase("es").includes(normalizedQuery),
        );
    });
  }, [area, query, services, subarea]);
  const pagination = usePagination(
    visible,
    "noma:services:page-size",
    `${area}:${subarea}:${query}`,
  );
  const pageServices = pagination.pageItems;
  const groups = presentAreas.filter((a) => area === "all" || a === area);

  return (
    <div>
      <div className="mb-6 space-y-3">
        <div className="relative max-w-xl">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, descripción o subárea…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
        <FilterChip active={area === "all"} onClick={() => {
          setArea("all");
          setSubarea("all");
        }}>
          Todos
        </FilterChip>
        {presentAreas.map((a) => (
          <FilterChip key={a} active={area === a} onClick={() => {
            setArea(a);
            setSubarea("all");
          }}>
            {a}
          </FilterChip>
        ))}
        </div>
        {availableSubareas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={subarea === "all"}
              onClick={() => setSubarea("all")}
            >
              Todas las subáreas
            </FilterChip>
            {availableSubareas.map((item) => (
              <FilterChip
                key={item}
                active={subarea === item}
                onClick={() => setSubarea(item)}
              >
                {item}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-8">
        {visible.length === 0 && (
          <div className="glass text-muted-foreground rounded-xl p-8 text-center text-sm">
            No encontramos servicios con esos filtros.
          </div>
        )}
        {groups.map((a) => {
          const items = pageServices.filter((s) => s.area === a);
          if (items.length === 0) return null;
          // subáreas en orden de aparición; los sin subárea van al final
          const groupSubareas = [
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
                {groupSubareas.map((sub) => (
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
                            canEdit={canEdit}
                            rates={rates}
                            subareas={subareas}
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
                        canEdit={canEdit}
                        rates={rates}
                        subareas={subareas}
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
