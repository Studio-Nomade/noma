"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Search, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/currency/format";
import { equivalences, type Rates } from "@/lib/currency/convert";
import {
  AREA_LABELS,
  SERVICE_PRIORITIES,
  type Area,
  type Currency,
  type ServicePriority,
} from "@/types/enums";
import type { Service } from "@/db/schema";
import type { ProposalServiceRow } from "./queries";
import { lineAmount } from "./totals";
import {
  addProposalService,
  removeProposalService,
  updateProposalServicePriority,
  updateProposalServicePrice,
  updateProposalServiceQuantity,
} from "./actions";

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
  rates,
}: {
  proposalId: string;
  selected: ProposalServiceRow[];
  catalog: Service[];
  rates: Rates;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const catalogAreas = [...new Set(catalog.map((service) => service.area))];
  const [activeArea, setActiveArea] = useState<Area>(catalogAreas[0] ?? "B&D");

  const selectedIds = new Set(selected.map((s) => s.serviceId));
  const filtered = catalog.filter((s) => {
    if (selectedIds.has(s.id)) return false;
    if (s.area !== activeArea) return false;
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
  function setPriority(rowId: string, priority: ServicePriority) {
    startTransition(async () => {
      const res = await updateProposalServicePriority(
        rowId,
        proposalId,
        priority,
      );
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }
  function setQuantity(rowId: string, quantity: number) {
    startTransition(async () => {
      const res = await updateProposalServiceQuantity(
        rowId,
        proposalId,
        quantity,
      );
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }
  function setPrice(rowId: string, amount: number, currency: Currency) {
    startTransition(async () => {
      const res = await updateProposalServicePrice(
        rowId,
        proposalId,
        amount,
        currency,
      );
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
              <div className="text-muted-foreground hidden grid-cols-[minmax(0,1fr)_9rem_5rem_10rem_2rem] gap-3 border-b pb-2 text-[11px] font-medium tracking-wide uppercase md:grid">
                <span>Servicio</span>
                <span className="text-right">Valor unitario</span>
                <span className="text-center">Cantidad</span>
                <span className="text-right">Valor total</span>
                <span />
              </div>
              <ul className="divide-border divide-y">
                {items.map((s) => {
                  const baseAmount = Number(
                    s.customPriceAmount ?? s.priceAmount,
                  );
                  const currency = (s.customPriceCurrency ??
                    s.priceCurrency ??
                    "UF") as Currency;
                  const lineTotal = lineAmount({
                    amount: Number.isFinite(baseAmount) ? baseAmount : null,
                    currency,
                    quantity: s.quantity,
                    priority: s.priority,
                  });
                  return (
                    <li key={s.id} className="py-3">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_9rem_5rem_10rem_2rem] md:items-start">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {s.name}
                          </p>
                          {s.subarea && (
                            <p className="text-muted-foreground text-xs">
                              {s.subarea}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={baseAmount}
                              aria-label={`Valor unitario de ${s.name}`}
                              className="h-8 w-24 text-right text-sm"
                              onBlur={(event) =>
                                setPrice(
                                  s.id,
                                  Number(event.target.value),
                                  currency,
                                )
                              }
                            />
                            <Select
                              value={currency}
                              onValueChange={(value) =>
                                setPrice(s.id, baseAmount, value as Currency)
                              }
                            >
                              <SelectTrigger size="sm" className="w-[4.5rem]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(["UF", "CLP", "USD"] as Currency[]).map(
                                  (item) => (
                                    <SelectItem key={item} value={item}>
                                      {item}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="text-muted-foreground text-[10px] leading-tight">
                            {equivalences(baseAmount, currency, rates)}
                          </p>
                        </div>
                        <div className="glass-hairline flex h-8 items-center justify-center rounded-lg">
                          <button
                            type="button"
                            aria-label="Menos"
                            disabled={pending || s.quantity <= 1}
                            onClick={() => setQuantity(s.id, s.quantity - 1)}
                            className="hover:text-foreground text-muted-foreground flex size-7 items-center justify-center disabled:opacity-40"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm tabular-nums">
                            {s.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Más"
                            disabled={pending}
                            onClick={() => setQuantity(s.id, s.quantity + 1)}
                            className="hover:text-foreground text-muted-foreground flex size-7 items-center justify-center disabled:opacity-40"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold whitespace-nowrap">
                            {formatMoney(lineTotal, currency)}
                          </span>
                          <p className="text-muted-foreground mt-1 text-[10px] leading-tight">
                            {equivalences(lineTotal, currency, rates)}
                          </p>
                          {s.priority !== "Normal" && (
                            <p className="text-destructive mt-1 text-[10px] font-medium uppercase">
                              Incluye recargo · {s.priority}
                            </p>
                          )}
                        </div>
                        <div className="flex justify-end">
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
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {/* Prioridad */}
                        <Select
                          value={s.priority}
                          onValueChange={(v) =>
                            setPriority(s.id, v as ServicePriority)
                          }
                        >
                          <SelectTrigger size="sm" className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SERVICE_PRIORITIES.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </li>
                  );
                })}
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
        {catalogAreas.length > 1 && (
          <Tabs
            value={activeArea}
            onValueChange={(value) => setActiveArea(value as Area)}
            className="mb-3"
          >
            <TabsList className="h-auto w-full flex-wrap justify-start">
              {catalogAreas.map((area) => (
                <TabsTrigger key={area} value={area} className="flex-none">
                  {area} · {AREA_LABELS[area]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {groupByArea(filtered).map(([area, items]) => (
            <div key={area}>
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
