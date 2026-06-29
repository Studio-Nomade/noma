"use client";

import { useState } from "react";
import { useForm, Controller, type Control } from "react-hook-form";
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
  PROJECT_STATUSES,
  COMMERCIAL_STAGES,
  PRIORITIES,
  PROJECT_TYPES_BY_AREA,
} from "@/types/enums";
import type { Project } from "@/db/schema";

type TeamOption = { id: string; name: string };
import { projectSchema, type ProjectFormValues } from "./schema";
import { createProject, updateProject } from "./actions";

type ClientOption = { id: string; companyName: string };

function toDefaults(
  project?: Project | null,
  presetClientId?: string,
): ProjectFormValues {
  return {
    name: project?.name ?? "",
    clientId: project?.clientId ?? presetClientId ?? "",
    area: project?.area ?? "B&D",
    projectType: project?.projectType ?? "",
    description: project?.description ?? "",
    mainObjective: project?.mainObjective ?? "",
    startDate: project?.startDate ?? "",
    deliveryDate: project?.deliveryDate ?? "",
    budgetAmount: project?.budgetAmount ?? "",
    budgetCurrency: project?.budgetCurrency ?? "UF",
    status: project?.status ?? "Levantamiento",
    commercialStage: project?.commercialStage ?? "Nuevo lead",
    priority: project?.priority ?? "Media",
    responsible: project?.responsible ?? "",
    nextAction: project?.nextAction ?? "",
    internalNotes: project?.internalNotes ?? "",
  };
}

/** Select controlado reutilizable para enums dentro del form. */
function EnumSelect({
  control,
  name,
  options,
  labels,
}: {
  control: Control<ProjectFormValues>;
  name: keyof ProjectFormValues;
  options: readonly string[];
  labels?: Record<string, string>;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          value={field.value as string}
          onValueChange={(v) => field.onChange(v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {labels?.[o] ?? o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

export function ProjectDialog({
  project,
  clients,
  teamMembers = [],
  presetClientId,
  trigger,
}: {
  project?: Project | null;
  clients: ClientOption[];
  teamMembers?: TeamOption[];
  presetClientId?: string;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(project);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: toDefaults(project, presetClientId),
  });

  const selectedArea = watch("area");
  const projectTypeOptions = PROJECT_TYPES_BY_AREA[selectedArea] ?? [];

  async function onSubmit(values: ProjectFormValues) {
    const result = isEdit
      ? await updateProject(project!.id, values)
      : await createProject(values);
    if (result.ok) {
      toast.success(isEdit ? "Proyecto actualizado" : "Proyecto creado");
      setOpen(false);
      if (!isEdit) reset(toDefaults(null, presetClientId));
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(toDefaults(project, presetClientId));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar proyecto" : "Nuevo proyecto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field
            label="Nombre del proyecto"
            required
            error={errors.name?.message}
          >
            <Input {...register("name")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente" required error={errors.clientId?.message}>
              <Controller
                control={control}
                name="clientId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Área" error={errors.area?.message}>
              <EnumSelect
                control={control}
                name="area"
                options={AREAS}
                labels={AREA_LABELS}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de proyecto" error={errors.projectType?.message}>
              <Controller
                control={control}
                name="projectType"
                render={({ field }) => (
                  <Select
                    value={field.value || ""}
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Según el área…" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectTypeOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Prioridad" error={errors.priority?.message}>
              <EnumSelect
                control={control}
                name="priority"
                options={PRIORITIES}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estado" error={errors.status?.message}>
              <EnumSelect
                control={control}
                name="status"
                options={PROJECT_STATUSES}
              />
            </Field>
            <Field
              label="Etapa comercial"
              error={errors.commercialStage?.message}
            >
              <EnumSelect
                control={control}
                name="commercialStage"
                options={COMMERCIAL_STAGES}
              />
            </Field>
          </div>

          <Field
            label="Objetivo principal"
            error={errors.mainObjective?.message}
          >
            <Textarea rows={2} {...register("mainObjective")} />
          </Field>

          <Field label="Descripción breve" error={errors.description?.message}>
            <Textarea rows={2} {...register("description")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha inicio" error={errors.startDate?.message}>
              <Input type="date" {...register("startDate")} />
            </Field>
            <Field label="Fecha entrega" error={errors.deliveryDate?.message}>
              <Input type="date" {...register("deliveryDate")} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Presupuesto" error={errors.budgetAmount?.message}>
              <Input type="number" step="0.01" {...register("budgetAmount")} />
            </Field>
            <Field label="Moneda" error={errors.budgetCurrency?.message}>
              <EnumSelect
                control={control}
                name="budgetCurrency"
                options={CURRENCIES}
              />
            </Field>
            <Field label="Responsable" error={errors.responsible?.message}>
              <Controller
                control={control}
                name="responsible"
                render={({ field }) => (
                  <Select
                    value={field.value || ""}
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Equipo…" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((m) => (
                        <SelectItem key={m.id} value={m.name}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field label="Próxima acción" error={errors.nextAction?.message}>
            <Input
              placeholder="Ej: Enviar propuesta al cliente · Lunes"
              {...register("nextAction")}
            />
          </Field>

          <Field label="Notas internas" error={errors.internalNotes?.message}>
            <Textarea rows={2} {...register("internalNotes")} />
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
                  : "Guardar proyecto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
