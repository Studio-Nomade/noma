"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency/format";
import { AREA_LABELS, type Area, type Currency } from "@/types/enums";
import type { Service } from "@/db/schema";
import type { ProposalServiceRow } from "./queries";
import { addProposalService, removeProposalService } from "./actions";

function groupByArea<T extends { area: Area }>(items: T[]): [Area, T[]][] {
  const map = new Map<Area, T[]>();
  for (const it of items) {
    const arr = map.get(it.area) ?? [];
    arr.push(it);
    map.set(it.area, arr);
  }
  return [...map.entries()];
}

export function ServiceSelector({
  proposalId,
  selected,
  catalog,
}: {
  proposalId: string;
  selected: ProposalServiceRow[];
  catalog: Service[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const selectedIds = new Set(selected.map((s) => s.serviceId));
  const filtered = catalog.filter((s) => {
    if (selectedIds.has(s.id)) return false;
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return [s.name, s.subarea]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(q));
  });

  const multiArea = new Set(catalog.map((s) => s.area)).size > 1;

  function add(serviceId: string) {
    startTransition(async () => {
      const res = await addProposalService(proposalId, serviceId);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }
  function remove(rowId: string) {
    startTransition(async () => {
      const res = await removeProposalService(rowId, proposalId);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {/* Seleccionados, agrupados por área */}
      <div>
        <h3 className="font-heading mb-2 text-sm font-medium">
          Servicios incluidos ({selected.length})
        </h3>
        {selected.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aún no hay servicios. Agrégalos desde el catálogo.
          </p>
        ) : (
          groupByArea(selected).map(([area, items]) => (
            <div key={area} className="mb-3">
              {multiArea && (
                <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                  {area} · {AREA_LABELS[area]}
                </p>
              )}
              <ul className="divide-border divide-y">
                {items.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      {s.subarea && (
                        <p className="text-muted-foreground text-xs">
                          {s.subarea}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium whitespace-nowrap">
                        {formatMoney(
                          s.customPriceAmount ?? s.priceAmount,
                          (s.customPriceCurrency ??
                            s.priceCurrency ??
                            "UF") as Currency,
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(s.id)}
                        disabled={pending}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Quitar"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Catálogo, agrupado por área */}
      <div>
        <h3 className="font-heading mb-2 text-sm font-medium">Catálogo</h3>
        <div className="relative mb-3">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar servicio…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-96 space-y-3 overflow-y-auto">
          {groupByArea(filtered).map(([area, items]) => (
            <div key={area}>
              {multiArea && (
                <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                  {area} · {AREA_LABELS[area]}
                </p>
              )}
              <ul className="divide-border divide-y">
                {items.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{s.name}</p>
                      {s.subarea && (
                        <p className="text-muted-foreground text-xs">
                          {s.subarea}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatMoney(s.priceMinAmount, s.priceCurrency ?? "UF")}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => add(s.id)}
                        disabled={pending}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Sin servicios para agregar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
