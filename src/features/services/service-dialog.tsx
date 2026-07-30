"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/currency/format";
import { convertAmount, type Rates } from "@/lib/currency/convert";
import {
  AREAS,
  AREA_LABELS,
  SERVICE_STATUSES,
  type Currency,
} from "@/types/enums";
import type { Service } from "@/db/schema";
import { serviceSchema, type ServiceFormValues } from "./schema";
import { createService, updateService } from "./actions";
import {
  parseStructuredContent,
  serializeStructuredContent,
  type StructuredContentItem,
} from "@/features/proposals/structured-content";

function toDefaults(service?: Service | null): ServiceFormValues {
  return {
    name: service?.name ?? "",
    area: service?.area ?? "B&D",
    subarea: service?.subarea ?? "",
    description: service?.description ?? "",
    methodology: service?.methodology ?? "",
    deliverables: service?.deliverables ?? "",
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
}: {
  service?: Service | null;
  trigger: React.ReactElement;
  rates: Rates;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(service);

  const defaults = toDefaults(service);
  const [methodology, setMethodology] = useState<StructuredContentItem[]>(() =>
    parseStructuredContent(service?.methodology, "stages"),
  );
  const [deliverables, setDeliverables] = useState<StructuredContentItem[]>(
    () => parseStructuredContent(service?.deliverables, "deliverables"),
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: defaults,
  });
  const priceMin = Number(watch("priceMinAmount")) || 0;
  const priceMax = Number(watch("priceMaxAmount")) || 0;
  const priceCurrency = watch("priceCurrency");

  async function onSubmit(values: ServiceFormValues) {
    const payload = {
      ...values,
      methodology: serializeStructuredContent(methodology),
      deliverables: serializeStructuredContent(deliverables),
    };
    const result = isEdit
      ? await updateService(service!.id, payload)
      : await createService(payload);
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
    if (next) {
      reset(toDefaults(service));
      setMethodology(parseStructuredContent(service?.methodology, "stages"));
      setDeliverables(
        parseStructuredContent(service?.deliverables, "deliverables"),
      );
    }
  }

  function changeCurrency(next: Currency) {
    const current = getValues("priceCurrency");
    if (next === current) return;
    for (const field of ["priceMinAmount", "priceMaxAmount"] as const) {
      const raw = Number(getValues(field));
      if (!Number.isFinite(raw) || raw <= 0) continue;
      const converted = convertAmount(raw, current, next, rates);
      setValue(field, converted.toFixed(next === "CLP" ? 0 : 2), {
        shouldDirty: true,
      });
    }
    setValue("priceCurrency", next, { shouldDirty: true });
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

          <div className="grid gap-4 sm:grid-cols-3">
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
                placeholder="Ej: Identidad Visual"
                {...register("subarea")}
              />
            </Field>
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
          </div>

          <Field label="Descripción" error={errors.description?.message}>
            <Textarea rows={2} {...register("description")} />
          </Field>

          <StructuredServiceEditor
            label="Metodología / proceso"
            titlePlaceholder="Nombre del paso"
            descriptionPlaceholder="Descripción del proceso"
            items={methodology}
            onChange={setMethodology}
          />

          <StructuredServiceEditor
            label="Entregables incluidos"
            titlePlaceholder="Nombre del entregable"
            descriptionPlaceholder="Descripción o formato"
            items={deliverables}
            onChange={setDeliverables}
          />

          <div className="grid gap-4 sm:grid-cols-1">
            <Field
              label="Tiempo estimado"
              error={errors.estimatedTime?.message}
            >
              <Input
                placeholder="Ej: 4–6 semanas"
                {...register("estimatedTime")}
              />
            </Field>
          </div>

          <section className="border-border space-y-4 rounded-xl border p-4">
            <div>
              <h3 className="font-heading text-sm font-medium">
                Precio referencial
              </h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Al cambiar la moneda, los montos se convierten con las tasas
                vigentes sin alterar su valor económico.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_9rem]">
              <Field
                label={`Precio mínimo (${priceCurrency})`}
                error={errors.priceMinAmount?.message}
              >
                <Input
                  type="number"
                  min="0"
                  step={priceCurrency === "CLP" ? "1" : "0.01"}
                  {...register("priceMinAmount")}
                />
              </Field>
              <Field
                label={`Precio máximo (${priceCurrency})`}
                error={errors.priceMaxAmount?.message}
              >
                <Input
                  type="number"
                  min="0"
                  step={priceCurrency === "CLP" ? "1" : "0.01"}
                  {...register("priceMaxAmount")}
                />
              </Field>
              <Field label="Moneda" error={errors.priceCurrency?.message}>
                <Select
                  value={priceCurrency}
                  onValueChange={(value) => changeCurrency(value as Currency)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["UF", "CLP", "USD"] as Currency[]).map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["UF", "CLP", "USD"] as Currency[]).map((currency) => (
                <PriceEquivalent
                  key={currency}
                  currency={currency}
                  min={convertAmount(priceMin, priceCurrency, currency, rates)}
                  max={convertAmount(priceMax, priceCurrency, currency, rates)}
                />
              ))}
            </div>
            {(!rates.ufClp || !rates.usdClp) && (
              <p className="text-destructive text-xs">
                Faltan tasas vigentes; ejecuta npm run rates:sync antes de
                convertir.
              </p>
            )}
          </section>

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

function StructuredServiceEditor({
  label,
  titlePlaceholder,
  descriptionPlaceholder,
  items,
  onChange,
}: {
  label: string;
  titlePlaceholder: string;
  descriptionPlaceholder: string;
  items: StructuredContentItem[];
  onChange: (items: StructuredContentItem[]) => void;
}) {
  function update(index: number, patch: Partial<StructuredContentItem>) {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {items.map((item, index) => (
        <div
          key={index}
          className="border-border grid gap-2 rounded-lg border p-3 sm:grid-cols-[.8fr_1.2fr_auto]"
        >
          <Input
            value={item.title}
            placeholder={titlePlaceholder}
            onChange={(event) => update(index, { title: event.target.value })}
          />
          <Input
            value={item.description}
            placeholder={descriptionPlaceholder}
            onChange={(event) =>
              update(index, { description: event.target.value })
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Quitar elemento de ${label}`}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...items, { title: "", description: "" }])}
      >
        <Plus className="size-4" />
        Agregar elemento
      </Button>
    </div>
  );
}

function PriceEquivalent({
  currency,
  min,
  max,
}: {
  currency: Currency;
  min: number;
  max: number;
}) {
  const hasMin = Number.isFinite(min) && min > 0;
  const hasMax = Number.isFinite(max) && max > 0;
  const value =
    hasMin && hasMax
      ? `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`
      : hasMin
        ? formatMoney(min, currency)
        : hasMax
          ? formatMoney(max, currency)
          : "—";
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {currency}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
