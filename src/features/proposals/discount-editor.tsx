"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/currency/format";
import type { DiscountKind } from "@/types/enums";
import { updateProposalDiscount } from "./actions";

const KIND_LABEL: Record<DiscountKind, string> = {
  percent: "%",
  clp: "CLP",
  uf: "UF",
};

/**
 * Fila editable de descuento comercial dentro del panel de Totales. El descuento
 * se aplica sobre el neto (antes de IVA); `discountClp` viene ya calculado del
 * servidor para mostrar el monto resultante.
 */
export function DiscountEditor({
  proposalId,
  initial,
  discountClp,
  locked = false,
}: {
  proposalId: string;
  initial: { label: string | null; kind: DiscountKind | null; value: number | null };
  discountClp: number;
  locked?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(initial.label ?? "");
  const [kind, setKind] = useState<DiscountKind>(initial.kind ?? "percent");
  const [value, setValue] = useState(
    initial.value != null ? String(initial.value) : "",
  );

  const hasDiscount = initial.kind != null && discountClp > 0;

  function save() {
    const numeric = value.trim() === "" ? null : Number(value);
    startTransition(async () => {
      const res = await updateProposalDiscount(proposalId, {
        label: label.trim() || "Descuento",
        kind: numeric && numeric > 0 ? kind : null,
        value: numeric,
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function clear() {
    setLabel("");
    setValue("");
    startTransition(async () => {
      const res = await updateProposalDiscount(proposalId, {
        label: "",
        kind: null,
        value: null,
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  // Vista compacta (no editando)
  if (!editing) {
    if (!hasDiscount) {
      if (locked) return null;
      return (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-muted-foreground hover:text-foreground text-xs font-medium"
        >
          + Agregar descuento
        </button>
      );
    }
    return (
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground flex items-center gap-1.5">
          {initial.label || "Descuento"}
          {!locked && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="hover:text-foreground"
              aria-label="Editar descuento"
            >
              <Pencil className="size-3" />
            </button>
          )}
        </dt>
        <dd
          className="font-medium"
          style={{ color: "var(--status-emerald)" }}
        >
          − {formatMoney(discountClp, "CLP")}
        </dd>
      </div>
    );
  }

  // Vista de edición
  return (
    <div className="glass-hairline space-y-2 rounded-lg p-2.5">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Nombre del descuento"
        className="h-7 text-xs"
      />
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type="number"
          step="0.01"
          min="0"
          placeholder="Valor"
          className="h-7 text-xs"
        />
        <Select value={kind} onValueChange={(v) => setKind(v as DiscountKind)}>
          <SelectTrigger size="sm" className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(KIND_LABEL) as DiscountKind[]).map((k) => (
              <SelectItem key={k} value={k}>
                {KIND_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={pending}
          className="flex-1"
        >
          Guardar
        </Button>
        {hasDiscount && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clear}
            disabled={pending}
            aria-label="Quitar descuento"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
