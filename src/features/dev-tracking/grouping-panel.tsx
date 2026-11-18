"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Layers, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/shared/surface";
import {
  confirmGrouping,
  proposeGrouping,
  type GroupingProposal,
} from "./grouping-actions";
import {
  GROUP_KINDS,
  GROUP_KIND_LABEL,
  type GroupKind,
  type ProposedGroup,
} from "./grouping";

type PanelItem = { id: string; code: string; title: string; priority: string };

/**
 * Agrupa las solicitudes aprobadas en entregas: Noma propone (IA o reglas) y
 * Sebastián ajusta y confirma. Al confirmar se reservan los códigos nuevos.
 */
export function GroupingPanel({
  programId,
  items,
  next,
}: {
  programId: string;
  items: PanelItem[];
  next: { roadmap: number; module: number };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [proposal, setProposal] = useState<GroupingProposal | null>(null);
  const [groups, setGroups] = useState<ProposedGroup[]>([]);
  const itemById = new Map(items.map((i) => [i.id, i]));

  function propose() {
    start(async () => {
      const r = await proposeGrouping(programId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setProposal(r.data);
      setGroups(r.data.groups);
      if (r.data.note) toast.message(r.data.note);
    });
  }

  function patch(key: string, change: Partial<ProposedGroup>) {
    setGroups((gs) => gs.map((g) => (g.key === key ? { ...g, ...change } : g)));
  }

  function move(itemId: string, to: string) {
    setGroups((gs) => {
      let next = gs.map((g) => ({
        ...g,
        itemIds: g.itemIds.filter((id) => id !== itemId),
      }));
      if (to === "__nuevo") {
        const item = itemById.get(itemId);
        next.push({
          key: `nuevo:${Date.now()}`,
          kind: "mejora",
          code: null,
          title: item?.title.slice(0, 60) ?? "Nuevo grupo",
          reason: null,
          itemIds: [itemId],
        });
      } else {
        next = next.map((g) =>
          g.key === to ? { ...g, itemIds: [...g.itemIds, itemId] } : g,
        );
      }
      return next.filter((g) => g.itemIds.length > 0);
    });
  }

  // Vista previa de los códigos que se reservarán, en orden.
  let r = next.roadmap;
  let n = next.module;
  const preview = new Map<string, string>();
  for (const g of groups) {
    if (g.kind === "mejora") preview.set(g.key, `R${r++}`);
    if (g.kind === "modulo")
      preview.set(g.key, `NDes-${String(n++).padStart(3, "0")}`);
    if (g.kind === "existente" && g.code) preview.set(g.key, g.code);
  }
  const invalid = groups.some(
    (g) => (g.kind === "existente" && !g.code) || g.title.trim().length < 3,
  );

  function confirm() {
    start(async () => {
      const res = await confirmGrouping({
        programId,
        groups: groups.map((g) => ({
          kind: g.kind,
          code: g.kind === "existente" ? g.code : null,
          title: g.title.trim(),
          itemIds: g.itemIds,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.codes.length
          ? `Agrupadas ${res.data.grouped} · reservados ${res.data.codes.join(", ")}`
          : `Agrupadas ${res.data.grouped}`,
      );
      setProposal(null);
      setGroups([]);
      router.refresh();
    });
  }

  const sel = "border-input bg-background h-8 rounded-md border px-2 text-xs";

  if (!proposal) {
    return (
      <Surface
        padding="md"
        className="flex flex-wrap items-center gap-3 text-sm"
      >
        <Layers className="text-muted-foreground size-4" />
        <span className="flex-1">
          <span className="font-medium">
            {items.length} aprobadas por agrupar.
          </span>{" "}
          <span className="text-muted-foreground">
            Noma propone en qué roadmap o módulo va cada una; tú ajustas y
            confirmas.
          </span>
        </span>
        <Button size="sm" disabled={pending} onClick={propose}>
          <Sparkles className="size-4" />
          {pending ? "Agrupando…" : "Proponer agrupación"}
        </Button>
      </Surface>
    );
  }

  return (
    <Surface padding="md" className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          Propuesta de agrupación
          <span className="text-muted-foreground font-normal">
            {" "}
            · {proposal.source === "ia" ? "IA" : "reglas"} · {groups.length}{" "}
            grupos
          </span>
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              setProposal(null);
              setGroups([]);
            }}
          >
            <X className="size-4" /> Descartar
          </Button>
          <Button size="sm" disabled={pending || invalid} onClick={confirm}>
            {pending ? "Confirmando…" : "Confirmar agrupación"}
          </Button>
        </div>
      </div>

      <ul className="space-y-3">
        {groups.map((g) => (
          <li key={g.key} className="border-border rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-accent rounded px-1.5 py-0.5 font-mono text-xs">
                {preview.get(g.key) ?? "—"}
              </span>
              <select
                value={g.kind}
                onChange={(e) =>
                  patch(g.key, {
                    kind: e.target.value as GroupKind,
                    code:
                      e.target.value === "existente"
                        ? (proposal.open[0]?.code ?? null)
                        : null,
                  })
                }
                className={sel}
                aria-label="Tipo de grupo"
              >
                {GROUP_KINDS.map((k) => (
                  <option
                    key={k}
                    value={k}
                    disabled={k === "existente" && !proposal.open.length}
                  >
                    {GROUP_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              {g.kind === "existente" && (
                <select
                  value={g.code ?? ""}
                  onChange={(e) => {
                    const target = proposal.open.find(
                      (o) => o.code === e.target.value,
                    );
                    patch(g.key, {
                      code: e.target.value || null,
                      ...(target ? { title: target.title } : {}),
                    });
                  }}
                  className={sel}
                  aria-label="Roadmap o módulo en curso"
                >
                  {proposal.open.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.code} · {o.title}
                    </option>
                  ))}
                </select>
              )}
              <Input
                value={g.title}
                onChange={(e) => patch(g.key, { title: e.target.value })}
                className="h-8 min-w-48 flex-1 text-sm"
                aria-label="Nombre de la entrega"
                disabled={g.kind === "existente"}
              />
            </div>
            {g.reason && (
              <p className="text-muted-foreground mt-1.5 text-xs">{g.reason}</p>
            )}
            <ul className="mt-2 space-y-1">
              {g.itemIds.map((id) => {
                const it = itemById.get(id);
                return (
                  <li key={id} className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground font-mono text-xs">
                      {it?.code}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{it?.title}</span>
                    <select
                      value=""
                      onChange={(e) =>
                        e.target.value && move(id, e.target.value)
                      }
                      className={sel}
                      aria-label={`Mover ${it?.code ?? ""}`}
                    >
                      <option value="">Mover a…</option>
                      {groups
                        .filter((o) => o.key !== g.key)
                        .map((o) => (
                          <option key={o.key} value={o.key}>
                            {preview.get(o.key) ?? GROUP_KIND_LABEL[o.kind]} ·{" "}
                            {o.title.slice(0, 40)}
                          </option>
                        ))}
                      <option value="__nuevo">+ Grupo nuevo</option>
                    </select>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground flex items-center gap-1 text-xs">
        <Plus className="size-3" /> Usa «Mover a… → Grupo nuevo» para separar
        una solicitud. Los códigos se reservan al confirmar; «Sin roadmap» va a
        Asana sin número.
      </p>
    </Surface>
  );
}
