"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  QUOTER_LEARNING_KIND_LABELS,
  type QuoterLearningKind,
} from "@/types/enums";
import { setLearningActive, updateLearningStatement } from "./memory-actions";

export type LearningRow = {
  id: string;
  kind: string;
  scope: string;
  area: string | null;
  industry: string | null;
  statement: string;
  rationale: string | null;
  origin: string;
  active: boolean;
  timesApplied: number;
  createdAt: string;
  createdByEmail: string | null;
  serviceName: string | null;
  clientName: string | null;
  sourceProposalId: string | null;
  sourceProposalTitle: string | null;
};

function scopeLabel(row: LearningRow) {
  switch (row.scope) {
    case "area":
      return `Área ${row.area ?? "?"}`;
    case "servicio":
      return row.serviceName ?? "Servicio";
    case "cliente":
      return row.clientName ?? "Cliente";
    case "rubro":
      return `Rubro ${row.industry ?? "?"}`;
    default:
      return "General";
  }
}

export function LearningsTable({
  rows,
  canEdit,
}: {
  rows: LearningRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (showInactive || row.active) &&
        (!q ||
          [
            row.statement,
            row.rationale,
            row.serviceName,
            row.clientName,
            row.area,
            row.kind,
          ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(q))),
    );
  }, [rows, query, showInactive]);

  function toggle(row: LearningRow) {
    startTransition(async () => {
      const res = await setLearningActive(row.id, !row.active);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  function save(id: string) {
    startTransition(async () => {
      const res = await updateLearningStatement(id, draft);
      if (!res.ok) toast.error(res.error);
      else {
        setEditing(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-sm"
          placeholder="Buscar regla, servicio, cliente…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Mostrar desactivadas
        </label>
        <span className="text-muted-foreground ml-auto text-xs">
          {filtered.length} regla(s)
        </span>
      </div>
      <ul className="divide-border divide-y">
        {filtered.map((row) => (
          <li key={row.id} className={`py-3 ${row.active ? "" : "opacity-55"}`}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                {editing === row.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <Button
                      size="sm"
                      onClick={() => save(row.id)}
                      disabled={pending}
                    >
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm">{row.statement}</p>
                )}
                <p className="text-muted-foreground mt-1 text-xs">
                  {QUOTER_LEARNING_KIND_LABELS[
                    row.kind as QuoterLearningKind
                  ] ?? row.kind}{" "}
                  · {scopeLabel(row)} ·{" "}
                  {row.origin === "ia" ? "aprendida por Noma" : "del equipo"} ·
                  aplicada {row.timesApplied}×
                  {row.sourceProposalId && (
                    <>
                      {" · "}
                      <Link
                        className="underline"
                        href={`/proposals/${row.sourceProposalId}`}
                      >
                        {row.sourceProposalTitle ?? "propuesta"}
                      </Link>
                    </>
                  )}
                </p>
                {row.rationale && (
                  <p className="text-muted-foreground mt-1 text-xs italic">
                    {row.rationale}
                  </p>
                )}
              </div>
              {canEdit && editing !== row.id && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(row.id);
                      setDraft(row.statement);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggle(row)}
                    disabled={pending}
                  >
                    {row.active ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
