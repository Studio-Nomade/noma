"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/shared/field";
import { AREAS, AREA_LABELS, CURRENCIES, SERVICE_STATUSES } from "@/types/enums";
import { equivalences, type Rates } from "@/lib/currency/convert";
import type { Service } from "@/db/schema";
import { serviceSchema, type ServiceFormValues } from "./schema";
import { createService, updateService } from "./actions";

/**
 * Valor canónico (lo que guarda el formulario y espera zod): dígitos con punto
 * decimal, ej. "1234.5". El display usa formato chileno: miles con punto,
 * decimales con coma. Al escribir se acepta cualquiera de los dos y se normaliza.
 */
function toCanonical(raw: string): string {
  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (cleaned === "") return "";
  // Punto = separador de miles, coma = decimal (convención es-CL).
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  return normalized;
}

function formatCL(canonical: string): string {
  if (canonical === "" || canonical == null) return "";
  const n = Number(canonical);
  if (!Number.isFinite(n)) return canonical;
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(n);
}

/** Input de monto con separadores de miles/decimales (formato chileno). */
function MoneyField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [display, setDisplay] = useState(() => formatCL(value));

  // Re-sincroniza cuando el valor del formulario cambia desde fuera (reset al
  // abrir el diálogo), sin pisar lo que el usuario está tecleando.
  useEffect(() => {
    setDisplay((prev) => (toCanonical(prev) === value ? prev : formatCL(value)));
  }, [value]);

  return (
    <Input
      inputMode="decimal"
      value={display}
      onChange={(e) => {
        setDisplay(e.target.value);
        onChange(toCanonical(e.target.value));
      }}
      onBlur={() => setDisplay(formatCL(value))}
    />
  );
}

function toDefaults(service?: Service | null): ServiceFormValues {
  return {
    name: service?.name ?? "",
    area: service?.area ?? "B&D",
    subarea: service?.subarea ?? "",
    description: service?.description ?? "",
    deliverables: service?.deliverables ?? "",
    deliverableItems: service?.deliverableItems ?? [],
    estimatedTime: service?.estimatedTime ?? "",
    priceMinAmount: service?.priceMinAmount ?? "",
    priceMaxAmount: service?.priceMaxAmount ?? "",
    priceCurrency: service?.priceCurrency ?? "UF",
    requirements: service?.requirements ?? "",
    status: service?.status ?? "Activo",
  };
}

export function ServiceDialog({
  service,
  trigger,
  rates,
  subareasByArea = {},
}: {
  service?: Service | null;
  trigger: React.ReactElement;
  rates?: Rates;
  subareasByArea?: Record<string, string[]>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(service);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: toDefaults(service),
  });

  const deliverables = useFieldArray({ control, name: "deliverableItems" });

  // Precio mínimo + moneda en vivo para mostrar la equivalencia en las otras dos.
  const [minAmount, currency, area] = useWatch({
    control,
    name: ["priceMinAmount", "priceCurrency", "area"],
  });
  const numericMin = Number(minAmount);
  const showEquiv =
    rates != null &&
    rates.ufClp > 0 &&
    Number.isFinite(numericMin) &&
    numericMin > 0;

  const subareaOptions = subareasByArea[area] ?? [];

  async function onSubmit(values: ServiceFormValues) {
    const result = isEdit
      ? await updateService(service!.id, values)
      : await createService(values);
    if (result.ok) {
      toast.success(isEdit ? "Servicio actualizado" : "Servicio creado");
      setOpen(false);
      if (!isEdit) reset(toDefaults(null));
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(toDefaults(service));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar servicio" : "Nuevo servicio"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field
            label="Nombre del servicio"
            required
            error={errors.name?.message}
          >
            <Input {...register("name")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Área" error={errors.area?.message}>
              <Controller
                control={control}
                name="area"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AREAS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {AREA_LABELS[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Subárea" error={errors.subarea?.message}>
              <Input
                list="service-subareas"
                placeholder="Ej: Identidad Visual"
                {...register("subarea")}
              />
              {/* Sugerencias: subáreas ya usadas en el área seleccionada. */}
              <datalist id="service-subareas">
                {subareaOptions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
          </div>

          <Field label="Estado" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Descripción" error={errors.description?.message}>
            <Textarea rows={2} {...register("description")} />
          </Field>

          {/* Entregables como ítems (título + descripción opcional), igual que
              en el constructor de presupuesto. */}
          <Field label="Entregables incluidos">
            <div className="space-y-2">
              {deliverables.fields.map((f, i) => (
                <div
                  key={f.id}
                  className="glass-hairline space-y-2 rounded-lg p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Título del entregable"
                      {...register(`deliverableItems.${i}.title`)}
                    />
                    <button
                      type="button"
                      onClick={() => deliverables.remove(i)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Quitar entregable"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <Input
                    placeholder="Descripción (opcional)"
                    className="text-sm"
                    {...register(`deliverableItems.${i}.description`)}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  deliverables.append({ title: "", description: "" })
                }
              >
                <Plus className="size-4" />
                Agregar entregable
              </Button>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Tiempo estimado"
              error={errors.estimatedTime?.message}
            >
              <Input
                placeholder="Ej: 4–6 semanas"
                {...register("estimatedTime")}
              />
            </Field>
            <Field label="Precio mínimo" error={errors.priceMinAmount?.message}>
              <Controller
                control={control}
                name="priceMinAmount"
                render={({ field }) => (
                  <MoneyField
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
            </Field>
            <Field label="Precio máximo" error={errors.priceMaxAmount?.message}>
              <Controller
                control={control}
                name="priceMaxAmount"
                render={({ field }) => (
                  <MoneyField
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
            </Field>
          </div>

          <Field label="Moneda" error={errors.priceCurrency?.message}>
            <div className="flex items-center gap-3">
              <Controller
                control={control}
                name="priceCurrency"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <SelectTrigger className="w-32 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {/* Conversión del precio mínimo a las otras dos monedas, al lado. */}
              {showEquiv && (
                <p className="text-muted-foreground truncate text-xs">
                  ≈ {equivalences(numericMin, currency, rates)}
                </p>
              )}
            </div>
          </Field>

          <Field
            label="Requisitos para iniciar"
            error={errors.requirements?.message}
          >
            <Textarea rows={2} {...register("requirements")} />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Guardando…"
                : isEdit
                  ? "Guardar cambios"
                  : "Guardar servicio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
