"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import {
  AREAS,
  AREA_LABELS,
  CURRENCIES,
  SERVICE_STATUSES,
} from "@/types/enums";
import type { Service } from "@/db/schema";
import { serviceSchema, type ServiceFormValues } from "./schema";
import { createService, updateService } from "./actions";

function toDefaults(service?: Service | null): ServiceFormValues {
  return {
    name: service?.name ?? "",
    area: service?.area ?? "B&D",
    description: service?.description ?? "",
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
}: {
  service?: Service | null;
  trigger: React.ReactElement;
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

          <Field
            label="Entregables incluidos"
            error={errors.deliverables?.message}
          >
            <Textarea rows={2} {...register("deliverables")} />
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
              <Input
                type="number"
                step="0.01"
                {...register("priceMinAmount")}
              />
            </Field>
            <Field label="Precio máximo" error={errors.priceMaxAmount?.message}>
              <Input
                type="number"
                step="0.01"
                {...register("priceMaxAmount")}
              />
            </Field>
          </div>

          <Field label="Moneda" error={errors.priceCurrency?.message}>
            <Controller
              control={control}
              name="priceCurrency"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v)}
                >
                  <SelectTrigger className="w-full sm:w-40">
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
