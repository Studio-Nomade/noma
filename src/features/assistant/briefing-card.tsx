import Link from "next/link";
import {
  CalendarClock,
  ListChecks,
  Mail,
  MessageSquare,
  Sparkles,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STUDIO_TIME_ZONE } from "./config";
import { RefreshBriefingButton } from "./refresh-button";
import type { BriefingData, SourceKey } from "./types";

const SOURCE_ICON: Record<SourceKey, typeof Mail> = {
  asana: ListChecks,
  calendar: CalendarClock,
  gmail: Mail,
  slack: MessageSquare,
};

const SOURCE_NAME: Record<SourceKey, string> = {
  asana: "Asana",
  calendar: "Calendar",
  gmail: "Gmail",
  slack: "Slack",
};

function time(iso: string) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: STUDIO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function longDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Resumen diario del asistente en el inicio (piloto). */
export function BriefingCard({ data }: { data: BriefingData }) {
  const offSources = (Object.keys(data.sources) as SourceKey[]).filter(
    (key) => !data.sources[key].ok,
  );
  const chips = [
    data.counts.asanaOverdue && `${data.counts.asanaOverdue} atrasadas`,
    data.counts.asanaToday && `${data.counts.asanaToday} vencen hoy`,
    data.counts.asanaTomorrow && `${data.counts.asanaTomorrow} vencen mañana`,
    data.counts.gmailPending &&
      `${data.counts.gmailPending} correos por responder`,
    data.counts.slackMentions && `${data.counts.slackMentions} menciones`,
    data.counts.slackUnread && `${data.counts.slackUnread} sin leer en Slack`,
  ].filter(Boolean) as string[];

  return (
    <section className="glass-strong mt-8 rounded-xl p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs capitalize">
            {longDay(data.day)}
          </p>
          <h2 className="font-heading mt-1 flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4" />
            Tu día
          </h2>
          <p className="mt-2 max-w-3xl text-sm">{data.headline}</p>
        </div>
        <RefreshBriefingButton />
      </div>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Badge key={chip} variant="outline">
              {chip}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Prioridades
          </h3>
          {data.priorities.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nada urgente en tus cuentas conectadas.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {data.priorities.map((p, i) => {
                const Icon = SOURCE_ICON[p.source];
                return (
                  <li
                    key={`${p.source}-${i}`}
                    className="border-border flex items-start gap-3 rounded-lg border p-3"
                  >
                    <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{p.title}</p>
                      <p className="text-muted-foreground text-xs">{p.why}</p>
                    </div>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline underline-offset-2"
                      >
                        Abrir en {SOURCE_NAME[p.source]}
                      </a>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Reuniones de hoy
            </h3>
            {data.meetings.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {data.sources.calendar.ok
                  ? "Sin reuniones."
                  : "Calendar sin conectar."}
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {data.meetings.map((m, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-muted-foreground w-12 shrink-0 tabular-nums">
                      {m.allDay ? "Día" : time(m.startsAt)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{m.title}</span>
                    {m.meetLink && (
                      <a
                        href={m.meetLink}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Abrir Meet"
                      >
                        <Video className="size-4" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data.suggestions.length > 0 && (
            <div>
              <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Puedo ayudarte con
              </h3>
              <ul className="flex flex-col gap-1 text-sm">
                {data.suggestions.map((s, i) => (
                  <li key={i}>— {s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="text-muted-foreground mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>
          Actualizado a las {time(data.generatedAt)}
          {data.ai ? " · priorizado con Claude" : " · sin IA"}
        </span>
        {offSources.length > 0 && (
          <span>
            Sin {offSources.map((key) => SOURCE_NAME[key]).join(", ")}.{" "}
            <Link href="/integrations" className="underline underline-offset-2">
              Revisar conexiones
            </Link>
          </span>
        )}
      </div>
    </section>
  );
}

export function BriefingSkeleton() {
  return (
    <section className="glass-strong mt-8 animate-pulse rounded-xl p-4 sm:p-6">
      <div className="bg-muted h-4 w-40 rounded" />
      <div className="bg-muted mt-3 h-4 w-3/4 rounded" />
      <div className="bg-muted mt-6 h-24 rounded" />
      <p className="text-muted-foreground mt-4 text-xs">
        Noma está revisando tus tareas, correos y mensajes…
      </p>
    </section>
  );
}
