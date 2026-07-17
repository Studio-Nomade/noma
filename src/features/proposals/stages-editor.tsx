"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeGantt, type Stage } from "./gantt";
import { updateProposalStages } from "./actions";

export function StagesEditor({
  proposalId,
  initial,
  accent = "#f48134",
}: {
  proposalId: string;
  initial: Stage[];
  accent?: string;
}) {
  const router = useRouter();
  const [stages, setStages] = useState<Stage[]>(
    initial.length ? initial : [{ name: "", start: "", end: "" }],
  );
  const [saving, setSaving] = useState(false);

  function update(i: number, patch: Partial<Stage>) {
    setStages((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  }
  function add() {
    setStages((prev) => [...prev, { name: "", start: "", end: "" }]);
  }
  function remove(i: number) {
    setStages((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    const res = await updateProposalStages(proposalId, stages);
    setSaving(false);
    if (res.ok) {
      toast.success("Cronograma guardado");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const gantt = computeGantt(stages);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-medium">Cronograma (Gantt)</h2>
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="size-4" />
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      <ul className="space-y-2">
        {stages.map((s, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Etapa"
              value={s.name}
              onChange={(e) => update(i, { name: e.target.value })}
              className="min-w-40 flex-1"
            />
            <Input
              type="date"
              value={s.start}
              onChange={(e) => update(i, { start: e.target.value })}
              className="w-40"
            />
            <Input
              type="date"
              value={s.end}
              onChange={(e) => update(i, { end: e.target.value })}
              className="w-40"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Quitar etapa"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <Button size="sm" variant="outline" onClick={add}>
        <Plus className="size-4" />
        Agregar etapa
      </Button>

      {/* Mini Gantt en vivo */}
      {gantt && (
        <div className="border-border mt-2 space-y-1.5 rounded-lg border p-3">
          {gantt.rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-32 shrink-0 truncate">{r.name}</span>
              <div className="relative h-3 flex-1">
                <div
                  className="absolute top-0 h-3 rounded"
                  style={{
                    left: `${r.leftPct}%`,
                    width: `${r.widthPct}%`,
                    background: accent,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
