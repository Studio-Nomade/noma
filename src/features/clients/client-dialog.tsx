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
import { CLIENT_STATUSES } from "@/types/enums";
import type { Client } from "@/db/schema";
import { clientSchema, type ClientFormValues } from "./schema";
import { createClient, updateClient } from "./actions";

function toDefaults(client?: Client | null): ClientFormValues {
  return {
    companyName: client?.companyName ?? "",
    contactName: client?.contactName ?? "",
    contactRole: client?.contactRole ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    industry: client?.industry ?? "",
    website: client?.website ?? "",
    instagram: client?.instagram ?? "",
    linkedin: client?.linkedin ?? "",
    status: client?.status ?? "Prospecto",
    internalNotes: client?.internalNotes ?? "",
  };
}

export function ClientDialog({
  client,
  trigger,
}: {
  client?: Client | null;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(client);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: toDefaults(client),
  });

  async function onSubmit(values: ClientFormValues) {
    const result = isEdit
      ? await updateClient(client!.id, values)
      : await createClient(values);

    if (result.ok) {
      toast.success(isEdit ? "Cliente actualizado" : "Cliente creado");
      setOpen(false);
      if (!isEdit) reset(toDefaults(null));
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(toDefaults(client));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar cliente" : "Nuevo cliente"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field
            label="Nombre de empresa"
            required
            error={errors.companyName?.message}
          >
            <Input placeholder="Ej: Marca & Co." {...register("companyName")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Contacto principal"
              error={errors.contactName?.message}
            >
              <Input {...register("contactName")} />
            </Field>
            <Field label="Cargo" error={errors.contactRole?.message}>
              <Input {...register("contactRole")} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" {...register("email")} />
            </Field>
            <Field label="Teléfono" error={errors.phone?.message}>
              <Input {...register("phone")} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rubro" error={errors.industry?.message}>
              <Input {...register("industry")} />
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
                      {CLIENT_STATUSES.map((s) => (
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sitio web" error={errors.website?.message}>
              <Input {...register("website")} />
            </Field>
            <Field label="Instagram" error={errors.instagram?.message}>
              <Input {...register("instagram")} />
            </Field>
          </div>

          <Field label="LinkedIn" error={errors.linkedin?.message}>
            <Input {...register("linkedin")} />
          </Field>

          <Field label="Notas internas" error={errors.internalNotes?.message}>
            <Textarea rows={3} {...register("internalNotes")} />
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
                  : "Guardar cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
