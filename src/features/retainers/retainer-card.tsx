"use client";

import { useRef, useState, useTransition } from "react";
import { Pause, Play, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";
import { saveRetainer, setRetainerStatus } from "./actions";

type RetainerData = Awaited<
  ReturnType<typeof import("./queries").getProjectRetainer>
>;

export function RetainerCard({
  projectId,
  data,
}: {
  projectId: string;
  data: RetainerData;
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [unit, setUnit] = useState(data?.retainer.unit ?? "deliverables");
  const period = data?.period;
  const quota = Number(period?.quota ?? data?.retainer.quotaPerPeriod ?? 0);
  const consumed = Number(period?.consumed ?? 0);
  const remaining = Number(period?.remaining ?? quota);
  const percentage = quota > 0 ? Math.min(100, (consumed / quota) * 100) : 0;

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await saveRetainer({
        projectId,
        unit:
          String(formData.get("unit")) === "hours"
            ? "hours"
            : "deliverables",
        quotaPerPeriod: String(formData.get("quotaPerPeriod")),
        startDate: String(formData.get("startDate")),
        endDate: String(formData.get("endDate")),
        rolloverPolicy:
          String(formData.get("rolloverPolicy")) === "partial"
            ? "partial"
            : "none",
      });
      if (result.ok) toast.success("Retainer guardado.");
      else toast.error(result.error);
    });
  }

  function changeStatus(status: "active" | "paused") {
    if (!data) return;
    startTransition(async () => {
      const result = await setRetainerStatus(data.retainer.id, status);
      if (result.ok) toast.success(status === "active" ? "Retainer reactivado." : "Retainer pausado.");
      else toast.error(result.error);
    });
  }

  const unitLabel = unit === "hours" ? "horas" : "entregables";
  return (
    <div className="space-y-6">
      {data && (
        <section className="glass rounded-xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading font-medium">Saldo del período</h2>
              <p className="text-muted-foreground text-sm">
                {period
                  ? `${period.periodStart} — ${period.periodEnd}`
                  : "Sin período vigente"}
              </p>
            </div>
            <StatusBadge
              value={
                data.retainer.status === "active"
                  ? "Activo"
                  : data.retainer.status === "paused"
                    ? "Pausado"
                    : "Finalizado"
              }
            />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Metric label="Cuota" value={`${quota} ${unitLabel}`} />
            <Metric label="Consumido" value={`${consumed} ${unitLabel}`} />
            <Metric label="Disponible" value={`${remaining} ${unitLabel}`} />
          </div>
          <div className="bg-muted mt-4 h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="mt-4">
            {data.retainer.status === "active" ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => changeStatus("paused")}
              >
                <Pause /> Pausar
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => changeStatus("active")}
              >
                <Play /> Reactivar
              </Button>
            )}
          </div>
        </section>
      )}

      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          submit(new FormData(event.currentTarget));
        }}
        className="glass grid gap-4 rounded-xl p-6 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <h2 className="font-heading font-medium">
            {data ? "Configuración del retainer" : "Crear retainer"}
          </h2>
          <p className="text-muted-foreground text-sm">
            Define la bolsa mensual utilizada por el agente para clasificar el alcance.
          </p>
        </div>
        <Field label="Unidad">
          <select
            name="unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="deliverables">Entregables</option>
            <option value="hours">Horas</option>
          </select>
        </Field>
        <Field label={`Cuota mensual (${unitLabel})`}>
          <Input
            name="quotaPerPeriod"
            type="number"
            min="0.25"
            step="0.25"
            required
            defaultValue={data?.retainer.quotaPerPeriod ?? ""}
          />
        </Field>
        <Field label="Fecha de inicio">
          <Input
            name="startDate"
            type="date"
            required
            defaultValue={
              data?.retainer.startDate ?? new Date().toISOString().slice(0, 10)
            }
          />
        </Field>
        <Field label="Fecha de término (opcional)">
          <Input
            name="endDate"
            type="date"
            defaultValue={data?.retainer.endDate ?? ""}
          />
        </Field>
        <Field label="Arrastre de saldo">
          <select
            name="rolloverPolicy"
            defaultValue={data?.retainer.rolloverPolicy ?? "none"}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="none">No acumular</option>
            <option value="partial">Acumular saldo disponible</option>
          </select>
        </Field>
        <div className="flex items-end">
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              if (formRef.current?.reportValidity()) {
                submit(new FormData(formRef.current));
              }
            }}
          >
            <Save /> Guardar
          </Button>
        </div>
      </form>

      {data?.history.length ? (
        <section className="glass rounded-xl p-6">
          <h2 className="font-heading mb-4 font-medium">Consumos del período</h2>
          <ul className="divide-border divide-y">
            {data.history.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                <span>{item.summary || "Solicitud sin resumen"}</span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {item.consumedAt ? `${Number(item.units)} ${unitLabel}` : "Sin consumo"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs uppercase">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
