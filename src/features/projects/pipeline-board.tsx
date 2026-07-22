"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, GripVertical, KanbanSquare, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { AvatarCircle } from "@/components/shared/avatar-circle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AREA_LABELS,
  AREAS,
  CURRENCIES,
  PIPELINE_STAGES,
  STAGE_ALIASES,
  type Area,
  type CommercialStage,
  type Currency,
} from "@/types/enums";
import { AREA_THEME } from "@/lib/brand/brand";
import { formatMoney } from "@/lib/currency/format";
import { formatDate, toNum } from "@/features/finance/helpers";
import { setCommercialStage } from "./actions";
import type { ProjectListItem } from "./queries";
import type { PipelinePanelData } from "./queries";
import { PipelinePanel, stageAge } from "./pipeline-panel";

/** Columna del pipeline a la que pertenece una etapa (aplica alias heredados). */
function columnFor(stage: CommercialStage): CommercialStage {
  if (PIPELINE_STAGES.includes(stage)) return stage;
  return STAGE_ALIASES[stage] ?? PIPELINE_STAGES[0];
}

export function PipelineBoard({
  projects,
  panelData,
  team,
}: {
  projects: ProjectListItem[];
  panelData: Record<string, PipelinePanelData>;
  team: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [items, setItems] = useState(projects);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<CommercialStage | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [area, setArea] = useState<"all" | Area>("all");
  const [responsible, setResponsible] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const justDragged = useRef(false);

  const responsibleOptions = useMemo(
    () =>
      [
        ...new Set(items.map((project) => project.responsible).filter(Boolean)),
      ].sort((a, b) => a!.localeCompare(b!, "es")) as string[],
    [items],
  );

  const filteredItems = useMemo(
    () =>
      items.filter(
        (project) =>
          (area === "all" || project.area === area) &&
          (responsible === "all" || project.responsible === responsible),
      ),
    [area, items, responsible],
  );

  const byColumn = useMemo(() => {
    const map = new Map<CommercialStage, ProjectListItem[]>();
    for (const stage of PIPELINE_STAGES) map.set(stage, []);
    for (const p of filteredItems) {
      const col = columnFor(p.commercialStage as CommercialStage);
      map.get(col)!.push(p);
    }
    return map;
  }, [filteredItems]);

  async function move(id: string, stage: CommercialStage) {
    const current = items.find((p) => p.id === id);
    if (
      !current ||
      columnFor(current.commercialStage as CommercialStage) === stage
    )
      return;
    const prev = items;
    // optimista
    setItems((list) =>
      list.map((p) =>
        p.id === id
          ? { ...p, commercialStage: stage, stageChangedAt: new Date() }
          : p,
      ),
    );
    setPending((s) => new Set(s).add(id));
    const res = await setCommercialStage(id, stage);
    setPending((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    if (!res.ok) {
      setItems(prev); // rollback
      toast.error(res.error);
    } else {
      toast.success(`Movido a "${stage}"`);
      router.refresh();
    }
  }

  const selectedProject = items.find((item) => item.id === selectedId) ?? null;
  const selectedSiblings = selectedProject
    ? (byColumn.get(
        columnFor(selectedProject.commercialStage as CommercialStage),
      ) ?? [])
    : [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="border-border bg-card inline-flex rounded-lg border p-0.5">
          <button
            onClick={() => setView("kanban")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              view === "kanban"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <KanbanSquare className="size-3.5" />
            Kanban
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              view === "list"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="size-3.5" />
            Lista
          </button>
        </div>
        <PipelineFilter
          value={area}
          onValueChange={(value) => setArea(value as "all" | Area)}
          label="Todas las áreas"
          options={AREAS.map((value) => ({
            value,
            label: AREA_LABELS[value],
          }))}
        />
        <PipelineFilter
          value={responsible}
          onValueChange={setResponsible}
          label="Todos los responsables"
          options={responsibleOptions.map((value) => ({ value, label: value }))}
        />
        <p className="text-muted-foreground text-xs">
          {filteredItems.length}
          {filteredItems.length !== items.length && ` de ${items.length}`}{" "}
          {filteredItems.length === 1 ? "oportunidad" : "oportunidades"} ·
          arrastra las tarjetas para cambiar de etapa
        </p>
      </div>

      {view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const list = byColumn.get(stage) ?? [];
            const totals = totalsByCurrency(list);
            return (
              <div
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(stage);
                }}
                onDragLeave={() => setOverCol((c) => (c === stage ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverCol(null);
                  if (dragId) move(dragId, stage);
                  setDragId(null);
                }}
                className={cn(
                  "flex w-64 shrink-0 flex-col rounded-xl border transition-colors",
                  overCol === stage
                    ? "border-foreground/40 bg-accent"
                    : "border-border bg-muted/30",
                )}
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs font-semibold tracking-wide uppercase">
                    {stage}
                  </span>
                  <span className="text-muted-foreground bg-background rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                    {list.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 px-2 pb-2">
                  {list.map((p) => {
                    const theme = AREA_THEME[p.area];
                    return (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={() => {
                          justDragged.current = true;
                          setDragId(p.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          window.setTimeout(() => {
                            justDragged.current = false;
                          }, 0);
                        }}
                        onClick={() => {
                          if (!justDragged.current) setSelectedId(p.id);
                        }}
                        className={cn(
                          "group border-border bg-card hover:border-foreground/30 cursor-pointer rounded-lg border p-2.5 shadow-sm transition-all",
                          pending.has(p.id) && "opacity-50",
                          dragId === p.id && "rotate-1 opacity-60",
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical className="text-muted-foreground/40 mt-0.5 size-3.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {p.name}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {p.clientName}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              <span
                                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                                style={{ background: theme.accent }}
                              >
                                {p.area}
                              </span>
                              <StatusBadge value={p.priority} size="xs" />
                            </div>
                            <dl className="text-muted-foreground mt-2 space-y-1 text-[11px]">
                              <div className="flex items-center justify-between gap-2">
                                <dt>Presupuesto</dt>
                                <dd className="text-foreground font-medium">
                                  {formatMoney(
                                    p.budgetAmount,
                                    p.budgetCurrency ?? "UF",
                                  )}
                                </dd>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <CalendarDays className="size-3 shrink-0" />
                                <span>
                                  Entrega {formatDate(p.deliveryDate)}
                                </span>
                              </div>
                              <div className="flex min-w-0 items-center gap-1.5">
                                <AvatarCircle
                                  name={p.responsible ?? "?"}
                                  className="size-5 shrink-0 text-[8px]"
                                />
                                <span className="truncate">
                                  {p.responsible ?? "Sin responsable"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <dt>{stageAge(p.stageChangedAt)}</dt>
                                <dd>
                                  {p.proposalCount} prop. · {p.briefCount} brief
                                </dd>
                              </div>
                            </dl>
                            {p.nextAction && (
                              <p className="text-muted-foreground mt-1.5 line-clamp-2 text-[11px]">
                                {p.nextAction}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {list.length === 0 && (
                    <div className="text-muted-foreground/60 rounded-lg border border-dashed py-6 text-center text-[11px]">
                      Sin oportunidades
                    </div>
                  )}
                </div>
                <div className="border-border mt-auto border-t px-3 py-2.5">
                  <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                    Total etapa
                  </p>
                  {totals.length > 0 ? (
                    <div className="space-y-0.5">
                      {totals.map(({ currency, amount }) => (
                        <p
                          key={currency}
                          className="text-xs font-semibold tabular-nums"
                        >
                          {formatMoney(amount, currency)}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs">
                <th className="px-4 py-2.5 font-medium">Oportunidad</th>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Área</th>
                <th className="px-4 py-2.5 font-medium">Etapa</th>
                <th className="px-4 py-2.5 font-medium">Prioridad</th>
                <th className="px-4 py-2.5 font-medium">Presupuesto</th>
                <th className="px-4 py-2.5 font-medium">Entrega</th>
                <th className="px-4 py-2.5 font-medium">Responsable</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className="border-border hover:bg-accent cursor-pointer border-b last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium">{p.name}</td>
                  <td className="text-muted-foreground px-4 py-2.5">
                    {p.clientName}
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5 text-xs">
                    {AREA_LABELS[p.area]}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge value={p.commercialStage} size="xs" />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge value={p.priority} size="xs" />
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium">
                    {formatMoney(p.budgetAmount, p.budgetCurrency ?? "UF")}
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5 text-xs">
                    {formatDate(p.deliveryDate)}
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5 text-xs">
                    {p.responsible ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PipelinePanel
        project={selectedProject}
        siblings={selectedSiblings}
        details={selectedId ? panelData[selectedId] : undefined}
        team={team}
        open={selectedId !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedId(null);
        }}
        onSelect={setSelectedId}
        onStageChange={(id, stage) => void move(id, stage)}
      />
    </div>
  );
}

function totalsByCurrency(projects: ProjectListItem[]) {
  const totals = new Map<Currency, number>();
  for (const project of projects) {
    if (!project.budgetAmount) continue;
    const currency = project.budgetCurrency ?? "UF";
    totals.set(
      currency,
      (totals.get(currency) ?? 0) + toNum(project.budgetAmount),
    );
  }
  return CURRENCIES.flatMap((currency) => {
    const amount = totals.get(currency);
    return amount ? [{ currency, amount }] : [];
  });
}

function PipelineFilter({
  value,
  onValueChange,
  label,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={(next) => next && onValueChange(next)}>
      <SelectTrigger size="sm" aria-label={label} className="max-w-52">
        <SelectValue>{value === "all" ? label : undefined}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
