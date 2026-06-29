"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
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
  const visible =
    area === "all" ? services : services.filter((s) => s.area === area);
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
          const items = visible.filter((s) => s.area === a);
          if (items.length === 0) return null;
          return (
            <section key={a}>
              <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                {a} · {AREA_LABELS[a]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((s) => (
                  <ServiceCard key={s.id} service={s} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
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
