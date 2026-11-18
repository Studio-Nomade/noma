import { CalendarPlus, ExternalLink, Plus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/shared/surface";
import { cn } from "@/lib/utils";
import { CancelMeetingButton } from "./cancel-meeting-button";
import { MeetingTypeDialog } from "./meeting-type-dialog";
import {
  CADENCE_LABELS,
  MEETING_STATUS_LABELS,
  WEEKDAY_LABELS,
  type DevMeetingStatus,
  type MeetingCadence,
} from "./meetings-constants";
import type { DevMeetingsData } from "./meetings-queries";
import { ScheduleDevMeetingDialog } from "./schedule-dev-meeting-dialog";

const STATUS_TONE: Record<DevMeetingStatus, string> = {
  agendada: "blue",
  realizada: "violet",
  transcrita: "violet",
  resumida: "amber",
  minuta_enviada: "emerald",
  cancelada: "slate",
};

export function MeetingsTab({
  programId,
  programName,
  data,
  today,
}: {
  programId: string;
  programName: string;
  data: DevMeetingsData;
  today: string;
}) {
  const { types, meetings, contacts, mailbox } = data;
  const now = Date.now();
  const upcoming = meetings
    .filter((m) => m.startsAt.getTime() >= now && m.status !== "cancelada")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const past = meetings.filter(
    (m) => m.startsAt.getTime() < now || m.status === "cancelada",
  );
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      {!mailbox.connected && (
        <Surface padding="md" className="text-sm">
          <p className="font-medium">
            La casilla de operaciones no está conectada a Google.
          </p>
          <p className="text-muted-foreground mt-1">
            {mailbox.reason} Mientras tanto, las reuniones se guardan en Noma
            sin evento ni Meet.
          </p>
        </Surface>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-medium">Tipos de reunión</h2>
          <MeetingTypeDialog
            programId={programId}
            contacts={contacts}
            trigger={
              <Button variant="outline" size="sm">
                <Plus className="size-4" /> Nuevo tipo
              </Button>
            }
          />
        </div>
        {types.length === 0 ? (
          <Surface padding="lg">
            <p className="text-muted-foreground text-sm">
              Define los tipos de reunión (revisión semanal, comercial,
              operaciones, gerencia…) con su cadencia y asistentes por defecto.
            </p>
          </Surface>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {types.map((t) => {
              const people = t.contactIds
                .map((id) => contactById.get(id)?.name ?? null)
                .filter(Boolean) as string[];
              return (
                <Surface key={t.id} variant="raised" padding="lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-heading truncate font-medium">
                        {t.name}
                      </h3>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {CADENCE_LABELS[t.cadence as MeetingCadence] ??
                          t.cadence}
                        {t.weekday != null && ` · ${WEEKDAY_LABELS[t.weekday]}`}
                        {t.timeOfDay && ` ${t.timeOfDay}`} · {t.durationMin} min
                      </p>
                    </div>
                    <MeetingTypeDialog
                      programId={programId}
                      contacts={contacts}
                      type={t}
                      trigger={
                        <Button variant="ghost" size="sm">
                          Editar
                        </Button>
                      }
                    />
                  </div>
                  {t.description && (
                    <p className="text-muted-foreground mt-2 text-sm">
                      {t.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs">
                    <span className="text-muted-foreground">Van siempre: </span>
                    {people.length || t.extraEmails.length
                      ? [...people, ...t.extraEmails].join(", ")
                      : "— (se eligen al agendar)"}
                  </p>
                  <ScheduleDevMeetingDialog
                    programId={programId}
                    programName={programName}
                    contacts={contacts}
                    type={t}
                    today={today}
                    mailbox={mailbox}
                    trigger={
                      <Button size="sm" className="mt-4 w-full">
                        <CalendarPlus className="size-4" /> Agendar
                      </Button>
                    }
                  />
                </Surface>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Surface padding="lg">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-heading text-sm font-medium">Próximas</h2>
            <ScheduleDevMeetingDialog
              programId={programId}
              programName={programName}
              contacts={contacts}
              today={today}
              mailbox={mailbox}
              trigger={
                <Button variant="outline" size="sm">
                  <CalendarPlus className="size-4" /> Reunión puntual
                </Button>
              }
            />
          </div>
          <MeetingList
            meetings={upcoming}
            empty="No hay reuniones agendadas."
            withCancel
          />
        </Surface>
        <Surface padding="lg">
          <h2 className="font-heading mb-4 text-sm font-medium">Anteriores</h2>
          <MeetingList
            meetings={past}
            empty="Todavía no hay reuniones realizadas."
          />
        </Surface>
      </section>
    </div>
  );
}

function MeetingList({
  meetings,
  empty,
  withCancel,
}: {
  meetings: DevMeetingsData["meetings"];
  empty: string;
  withCancel?: boolean;
}) {
  if (meetings.length === 0) {
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  }
  return (
    <ul className="divide-border divide-y">
      {meetings.map((m) => {
        const tone = STATUS_TONE[m.status as DevMeetingStatus] ?? "slate";
        return (
          <li
            key={m.id}
            className="flex items-start justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{m.title}</p>
              <p className="text-muted-foreground text-xs">
                {m.startsAt.toLocaleString("es-CL", {
                  timeZone: "America/Santiago",
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · {m.durationMin} min · {m.attendees.length} asistentes
                {m.organizerEmail && ` · desde ${m.organizerEmail}`}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  )}
                  style={{
                    color: `var(--status-${tone})`,
                    background: `var(--status-${tone}-bg)`,
                  }}
                >
                  {MEETING_STATUS_LABELS[m.status as DevMeetingStatus] ??
                    m.status}
                </span>
                {m.meetLink && (
                  <a
                    href={m.meetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium"
                  >
                    <Video className="size-3.5" /> Meet
                  </a>
                )}
                {m.calendarLink && (
                  <a
                    href={m.calendarLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                  >
                    Calendar <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
            {withCancel && m.status === "agendada" && (
              <CancelMeetingButton meetingId={m.id} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
