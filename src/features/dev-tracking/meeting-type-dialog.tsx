"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CADENCE_LABELS,
  MEETING_CADENCES,
  WEEKDAY_LABELS,
} from "./meetings-constants";
import { saveMeetingType } from "./meetings-actions";

export type ContactOption = {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
};

export function MeetingTypeDialog({
  programId,
  contacts,
  type,
  trigger,
}: {
  programId: string;
  contacts: ContactOption[];
  type?: {
    id: string;
    name: string;
    description: string | null;
    cadence: string;
    weekday: number | null;
    timeOfDay: string | null;
    durationMin: number;
    contactIds: string[];
    extraEmails: string[];
    agendaTemplate: string | null;
    producesBacklog: boolean;
  };
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string[]>(type?.contactIds ?? []);
  const [producesBacklog, setProducesBacklog] = useState(
    type?.producesBacklog ?? true,
  );

  function onSubmit(formData: FormData) {
    const extra = String(formData.get("extraEmails") ?? "")
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    start(async () => {
      const result = await saveMeetingType({
        id: type?.id ?? "",
        programId,
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        cadence: String(formData.get("cadence") ?? "adhoc") as
          "weekly" | "biweekly" | "monthly" | "adhoc",
        weekday: String(formData.get("weekday") ?? ""),
        timeOfDay: String(formData.get("timeOfDay") ?? ""),
        durationMin: Number(formData.get("durationMin") ?? 60),
        contactIds: selected,
        extraEmails: extra,
        agendaTemplate: String(formData.get("agendaTemplate") ?? ""),
        producesBacklog,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        type ? "Tipo de reunión actualizado" : "Tipo de reunión creado",
      );
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {type ? "Editar tipo de reunión" : "Nuevo tipo de reunión"}
          </DialogTitle>
          <DialogDescription>
            Define la cadencia y quiénes van siempre. Al agendar se puede
            ajustar.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mt-name">Nombre</Label>
            <Input
              id="mt-name"
              name="name"
              required
              defaultValue={type?.name ?? ""}
              placeholder="Revisión semanal"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-description">Para qué</Label>
            <Input
              id="mt-description"
              name="description"
              defaultValue={type?.description ?? ""}
              placeholder="Reportes de terreno y comercial de la semana"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="mt-cadence">Cadencia</Label>
              <select
                id="mt-cadence"
                name="cadence"
                defaultValue={type?.cadence ?? "adhoc"}
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              >
                {MEETING_CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {CADENCE_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-weekday">Día</Label>
              <select
                id="mt-weekday"
                name="weekday"
                defaultValue={type?.weekday ?? ""}
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              >
                <option value="">—</option>
                {WEEKDAY_LABELS.map((w, i) => (
                  <option key={w} value={i}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-time">Hora</Label>
              <Input
                id="mt-time"
                name="timeOfDay"
                type="time"
                defaultValue={type?.timeOfDay ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-duration">Minutos</Label>
              <Input
                id="mt-duration"
                name="durationMin"
                type="number"
                min={15}
                max={240}
                step={15}
                defaultValue={type?.durationMin ?? 60}
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Asistentes del cliente
            </legend>
            {contacts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                El cliente no tiene contactos cargados. Agrégalos en su ficha o
                usa correos sueltos.
              </p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {contacts.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.includes(c.id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) =>
                          v ? [...prev, c.id] : prev.filter((x) => x !== c.id),
                        )
                      }
                    />
                    <span className="truncate">
                      {c.name ?? c.email}
                      {c.role && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {c.role}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="mt-extra">Otros correos (separados por coma)</Label>
            <Input
              id="mt-extra"
              name="extraEmails"
              defaultValue={type?.extraEmails.join(", ") ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-agenda">
              Agenda fija (se agrega la pelota de cada módulo)
            </Label>
            <Textarea
              id="mt-agenda"
              name="agendaTemplate"
              rows={3}
              defaultValue={type?.agendaTemplate ?? ""}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={producesBacklog}
              onCheckedChange={(v) => setProducesBacklog(v === true)}
            />
            Esta reunión genera solicitudes para el backlog
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
