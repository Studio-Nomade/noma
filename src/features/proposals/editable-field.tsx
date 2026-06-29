"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { updateProposalField } from "./actions";

type Field =
  | "title"
  | "context"
  | "diagnosis"
  | "mainObjective"
  | "specificObjectives"
  | "scope"
  | "workStages"
  | "deliverables"
  | "timeline"
  | "clientRequirements"
  | "exclusions"
  | "team"
  | "commercialConditions"
  | "nextAction";

export function EditableField({
  proposalId,
  field,
  label,
  value,
  multiline = true,
  placeholder,
}: {
  proposalId: string;
  field: Field;
  label: string;
  value: string | null;
  multiline?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateProposalField(proposalId, field, draft);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="group">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          {label}
        </p>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(value ?? "");
              setEditing(true);
            }}
            className="text-muted-foreground hover:text-foreground opacity-0 transition group-hover:opacity-100"
            aria-label={`Editar ${label}`}
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {multiline ? (
            <Textarea
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
          ) : (
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap">
          {value || (
            <span className="text-muted-foreground italic">
              {placeholder ?? "Sin contenido"}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
