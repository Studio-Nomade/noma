"use client";

import { useMemo, useState, useTransition } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDotDashed,
  ExternalLink,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { scheduleDashboardMeeting } from "./actions";
import type {
  AsanaOperationsSummary,
  DashboardCalendar,
  MeetingProjectOption,
} from "./integrations";

const TIME_ZONE = "America/Santiago";

export function DashboardIntegrations({
  calendar,
  operations,
  meetingProjects,
}: {
  calendar: DashboardCalendar;
  operations: AsanaOperationsSummary;
  meetingProjects: MeetingProjectOption[];
}) {
  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
      <CalendarWeek calendar={calendar} projects={meetingProjects} />
      <AsanaOperations operations={operations} />
    </div>
  );
}

function dateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function CalendarWeek({
  calendar,
  projects,
}: {
  calendar: DashboardCalendar;
  projects: MeetingProjectOption[];
}) {
  const days = useMemo(() => {
    const from = new Date(calendar.from);
    return Array.from({ length: 7 }, (_, index) => {
      const value = new Date(from);
      value.setDate(from.getDate() + index);
      return value;
    });
  }, [calendar.from]);

  return (
    <section className="glass min-w-0 rounded-xl p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4" />
            Agenda de la semana
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Calendario personal · hora de Santiago
          </p>
        </div>
        {projects.length > 0 && <ScheduleCalendarMeeting projects={projects} />}
      </div>

      {!calendar.connected ? (
        <ConnectionNotice
          title="Reconecta Google Calendar"
          description={
            calendar.reason ??
            "Tu agenda no está disponible hasta renovar los permisos."
          }
          action={<ReconnectGoogleButton />}
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {days.map((day) => {
            const key = dateKey(day);
            const events = calendar.events.filter(
              (event) => dateKey(event.startsAt) === key,
            );
            return (
              <div
                key={key}
                className="border-border min-w-0 rounded-lg border p-2.5"
              >
                <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  {new Intl.DateTimeFormat("es-CL", {
                    timeZone: TIME_ZONE,
                    weekday: "short",
                    day: "numeric",
                  }).format(day)}
                </p>
                <div className="mt-2 space-y-1.5">
                  {events.length === 0 ? (
                    <p className="text-muted-foreground/70 py-2 text-[11px]">
                      Sin reuniones
                    </p>
                  ) : (
                    events.map((event) => {
                      const content = (
                        <>
                          <span className="block truncate text-xs font-medium">
                            {event.summary}
                          </span>
                          <span className="text-muted-foreground mt-0.5 block text-[10px]">
                            {event.allDay
                              ? "Todo el día"
                              : new Intl.DateTimeFormat("es-CL", {
                                  timeZone: TIME_ZONE,
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }).format(new Date(event.startsAt))}
                          </span>
                          {event.association && (
                            <span className="text-primary mt-1 block truncate text-[10px]">
                              {event.association.label}
                            </span>
                          )}
                        </>
                      );
                      const className = cn(
                        "block min-w-0 rounded-md border p-2",
                        event.association
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-muted/30",
                      );
                      return event.htmlLink ? (
                        <a
                          key={event.id}
                          href={event.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className={className}
                        >
                          {content}
                        </a>
                      ) : (
                        <div key={event.id} className={className}>
                          {content}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ScheduleCalendarMeeting({
  projects,
}: {
  projects: MeetingProjectOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const selected = projects.find((project) => project.id === projectId);
  const [title, setTitle] = useState(
    selected ? `Reunión · ${selected.name}` : "Reunión",
  );
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("45");
  const [emails, setEmails] = useState(
    selected?.contacts.map((contact) => contact.email).join(", ") ?? "",
  );

  function chooseProject(value: string) {
    setProjectId(value);
    const project = projects.find((item) => item.id === value);
    if (!project) return;
    setTitle(`Reunión · ${project.name}`);
    setEmails(project.contacts.map((contact) => contact.email).join(", "));
  }

  function submit() {
    startTransition(async () => {
      const result = await scheduleDashboardMeeting({
        projectId,
        title,
        date,
        time,
        durationMin: Number(duration),
        attendeeEmails: emails
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data.googleConnected) {
        toast.success("Reunión creada en Google Calendar.");
      } else {
        toast.warning("La reunión quedó registrada solo en Noma.", {
          description: result.data.googleReason,
        });
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus />
            Agendar reunión
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agendar reunión</DialogTitle>
          <DialogDescription>
            Crea la reunión en el calendario del usuario y genera un enlace de
            Google Meet.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Proyecto</Label>
            <Select
              value={projectId}
              onValueChange={(value) => value && chooseProject(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.clientName} · {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dashboard-meeting-title">Título</Label>
            <Input
              id="dashboard-meeting-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="dashboard-meeting-date">Fecha</Label>
              <Input
                id="dashboard-meeting-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dashboard-meeting-time">Hora</Label>
              <Input
                id="dashboard-meeting-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Duración</Label>
            <Select
              value={duration}
              onValueChange={(value) => setDuration(value ?? "45")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["30", "45", "60", "90"].map((minutes) => (
                  <SelectItem key={minutes} value={minutes}>
                    {minutes} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dashboard-meeting-attendees">Invitados</Label>
            <Input
              id="dashboard-meeting-attendees"
              value={emails}
              onChange={(event) => setEmails(event.target.value)}
              placeholder="correo@cliente.cl, otro@cliente.cl"
            />
            <p className="text-muted-foreground text-xs">
              Separa múltiples correos con coma.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={pending || !projectId || !title || !date || !time}
          >
            {pending ? "Agendando…" : "Crear reunión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AsanaOperations({
  operations,
}: {
  operations: AsanaOperationsSummary;
}) {
  return (
    <section className="glass min-w-0 rounded-xl p-4 sm:p-6">
      <div className="mb-5">
        <h2 className="font-heading flex items-center gap-2 text-sm font-medium">
          <BriefcaseBusiness className="size-4" />
          Proyectos en operación
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Ciclo de ejecución conectado con Asana
        </p>
      </div>
      {!operations.connected && operations.reason && (
        <ConnectionNotice
          title="Asana no está conectado"
          description={operations.reason}
        />
      )}
      {operations.items.length === 0 ? (
        <p className="text-muted-foreground mt-4 rounded-lg border border-dashed p-6 text-center text-sm">
          No hay proyectos traspasados a operación con enlace de Asana.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {operations.items.map((item) => (
            <li key={item.projectId}>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="border-border hover:bg-accent/50 block rounded-lg border p-3 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {item.projectName}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {item.clientName}
                    </span>
                  </span>
                  <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    {item.completed ? (
                      <CheckCircle2 className="text-primary size-3.5" />
                    ) : (
                      <CircleDotDashed className="size-3.5" />
                    )}
                    {item.completed === null
                      ? "Estado no disponible"
                      : item.completed
                        ? "Listo para cierre"
                        : item.kind === "task"
                          ? "En operación"
                          : `${item.progress ?? 0}% completado`}
                  </span>
                  <span className="text-muted-foreground text-[10px] uppercase">
                    {item.kind === "task"
                      ? "Tarea principal"
                      : item.kind === "project"
                        ? "Proyecto"
                        : "Enlace"}
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ConnectionNotice({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-muted/30 rounded-lg border p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 text-xs">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function ReconnectGoogleButton() {
  const [pending, startTransition] = useTransition();
  function reconnect() {
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.assign("/login?redirectTo=/");
    });
  }
  return (
    <Button variant="outline" size="sm" onClick={reconnect} disabled={pending}>
      <RefreshCw />
      {pending ? "Desconectando…" : "Reconectar Google"}
    </Button>
  );
}
