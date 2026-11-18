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
import type { ContactOption } from "./meeting-type-dialog";
import { scheduleDevMeeting } from "./meetings-actions";
import { nextOccurrence, type MeetingCadence } from "./meetings-constants";

export function ScheduleDevMeetingDialog({
  programId,
  programName,
  contacts,
  type,
  today,
  mailbox,
  trigger,
}: {
  programId: string;
  programName: string;
  contacts: ContactOption[];
  type?: {
    id: string;
    name: string;
    cadence: string;
    weekday: number | null;
    timeOfDay: string | null;
    durationMin: number;
    contactIds: string[];
    extraEmails: string[];
  };
  today: string; // YYYY-MM-DD
  mailbox: {
    connected: boolean;
    mailbox: string | null;
    reason: string | null;
  };
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string[]>(type?.contactIds ?? []);
  const [includeAgenda, setIncludeAgenda] = useState(true);

  const defaultDate = type
    ? nextOccurrence(type.cadence as MeetingCadence, type.weekday, today)
    : today;
  const defaultTitle = type ? `${type.name} · ${programName}` : "";

  function onSubmit(formData: FormData) {
    const extra = String(formData.get("extraEmails") ?? "")
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    start(async () => {
      const result = await scheduleDevMeeting({
        programId,
        meetingTypeId: type?.id ?? "",
        title: String(formData.get("title") ?? ""),
        date: String(formData.get("date") ?? ""),
        time: String(formData.get("time") ?? ""),
        durationMin: Number(formData.get("durationMin") ?? 60),
        contactIds: selected,
        extraEmails: extra,
        includeAgenda,
        agendaExtra: String(formData.get("agendaExtra") ?? ""),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data.calendarCreated) {
        toast.success("Reunión agendada con Meet desde operaciones");
      } else {
        toast.warning(
          `Reunión guardada en Noma, sin evento en Calendar: ${result.data.reason ?? ""}`,
        );
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Agendar {type ? type.name : "reunión"}</DialogTitle>
          <DialogDescription>
            {mailbox.connected
              ? `El evento sale con Meet desde ${mailbox.mailbox}; la transcripción de Gemini queda en su Drive.`
              : `Se guardará solo en Noma: ${mailbox.reason ?? "la casilla de operaciones no está conectada."}`}
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sm-title">Título</Label>
            <Input
              id="sm-title"
              name="title"
              required
              defaultValue={defaultTitle}
              placeholder={`Revisión semanal · ${programName}`}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="sm-date">Fecha</Label>
              <Input
                id="sm-date"
                name="date"
                type="date"
                required
                defaultValue={defaultDate}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm-time">Hora (Santiago)</Label>
              <Input
                id="sm-time"
                name="time"
                type="time"
                required
                defaultValue={type?.timeOfDay ?? "09:00"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm-duration">Minutos</Label>
              <Input
                id="sm-duration"
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
            <legend className="text-sm font-medium">Asistentes</legend>
            {contacts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                El cliente no tiene contactos cargados; usa correos sueltos.
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
            <p className="text-muted-foreground text-xs">
              Tú vas invitado siempre; la casilla de operaciones organiza.
            </p>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="sm-extra">Otros correos (separados por coma)</Label>
            <Input
              id="sm-extra"
              name="extraEmails"
              defaultValue={type?.extraEmails.join(", ") ?? ""}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={includeAgenda}
              onCheckedChange={(v) => setIncludeAgenda(v === true)}
            />
            Incluir la agenda previa (pelota y pendientes por módulo)
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="sm-agenda">Temas adicionales</Label>
            <Textarea id="sm-agenda" name="agendaExtra" rows={3} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Agendando…" : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
