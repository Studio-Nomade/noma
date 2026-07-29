"use client";

import { useState, useTransition } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveBillingPlan } from "./actions";

type Item = {
  id?: string;
  label: string;
  type: "PORCENTAJE" | "MONTO";
  value: number;
  tentativeDate: string | null;
  deliverable: string | null;
  status: "PENDIENTE" | "FACTURADO" | "PAGADO";
};

export function BillingPlanEditor({
  salesOrderId,
  initial,
}: {
  salesOrderId: string;
  initial: Item[];
}) {
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();

  function patch(index: number, values: Partial<Item>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...values } : item,
      ),
    );
  }

  function save() {
    startTransition(async () => {
      const result = await saveBillingPlan(salesOrderId, items);
      if (result.ok) toast.success("Esquema de facturación guardado");
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const locked = item.status !== "PENDIENTE";
        return (
          <div
            key={item.id ?? index}
            className="border-border grid gap-2 rounded-lg border p-3 md:grid-cols-[1.6fr_.8fr_.7fr_1fr_1.5fr_auto]"
          >
            <Input
              aria-label="Nombre del hito"
              value={item.label}
              disabled={locked}
              onChange={(event) => patch(index, { label: event.target.value })}
            />
            <select
              aria-label="Tipo de cálculo"
              value={item.type}
              disabled={locked}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              onChange={(event) =>
                patch(index, {
                  type: event.target.value as Item["type"],
                })
              }
            >
              <option value="PORCENTAJE">Porcentaje</option>
              <option value="MONTO">Monto CLP</option>
            </select>
            <Input
              aria-label="Valor"
              type="number"
              min="0"
              step={item.type === "PORCENTAJE" ? "0.01" : "1"}
              value={item.value}
              disabled={locked}
              onChange={(event) =>
                patch(index, { value: Number(event.target.value) })
              }
            />
            <Input
              aria-label="Fecha tentativa"
              type="date"
              value={item.tentativeDate ?? ""}
              disabled={locked}
              onChange={(event) =>
                patch(index, {
                  tentativeDate: event.target.value || null,
                })
              }
            />
            <Input
              aria-label="Entregable asociado"
              placeholder="Entregable / condición"
              value={item.deliverable ?? ""}
              disabled={locked}
              onChange={(event) =>
                patch(index, { deliverable: event.target.value || null })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Quitar hito"
              disabled={locked || items.length === 1}
              onClick={() =>
                setItems((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        );
      })}
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setItems((current) => [
              ...current,
              {
                label: `Hito ${current.length + 1}`,
                type: "PORCENTAJE",
                value: 0,
                tentativeDate: null,
                deliverable: null,
                status: "PENDIENTE",
              },
            ])
          }
        >
          <Plus className="size-4" /> Agregar hito
        </Button>
        <Button type="button" disabled={pending} onClick={save}>
          <Save className="size-4" />
          {pending ? "Guardando…" : "Guardar esquema"}
        </Button>
      </div>
    </div>
  );
}
