import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Video } from "lucide-react";
import { Surface } from "@/components/shared/surface";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getMeetingDetail } from "@/features/dev-tracking/minutes-queries";
import { MeetingProcessControls } from "@/features/dev-tracking/meeting-process-controls";
import {
  MEETING_STATUS_LABELS,
  type DevMeetingStatus,
} from "@/features/dev-tracking/meetings-constants";

export const dynamic = "force-dynamic";

const PRIORITY_TONE: Record<string, string> = {
  Crítica: "red",
  Alta: "amber",
  Media: "blue",
  Normal: "slate",
};

const ITEM_STATUS_LABEL: Record<string, string> = {
  propuesta: "Propuesta",
  aprobada: "Aprobada",
  descartada: "Descartada",
  en_asana: "En Asana",
  verificada: "Verificada",
};

const DESTINATION_LABEL: Record<string, string> = {
  roadmap_en_curso: "Roadmap en curso",
  backlog_general: "Backlog general",
  nuevo: "Nuevo",
};

export default async function MeetingMinutesPage({
  params,
}: {
  params: Promise<{ id: string; meetingId: string }>;
}) {
  const { id, meetingId } = await params;
  await requireUser();
  const detail = await getMeetingDetail(id, meetingId);
  if (!detail) notFound();
  const { meeting, minutes, items, questions, modules } = detail;
  const moduleById = new Map(modules.map((m) => [m.id, m.code]));
  const when = meeting.startsAt.toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    dateStyle: "full",
    timeStyle: "short",
  });

  return (
    <>
      <Link
        href={`/projects/${id}/seguimiento`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Volver al seguimiento
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            {detail.programName}
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {meeting.title}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {when} · {meeting.durationMin} min ·{" "}
            {MEETING_STATUS_LABELS[meeting.status as DevMeetingStatus] ??
              meeting.status}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            {meeting.meetLink && (
              <a
                href={meeting.meetLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium"
              >
                <Video className="size-3.5" /> Meet
              </a>
            )}
            {meeting.transcriptFileId && (
              <a
                href={`https://docs.google.com/document/d/${meeting.transcriptFileId}`}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Transcripción <ExternalLink className="size-3" />
              </a>
            )}
            {minutes?.gmailDraftId && (
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Mail className="size-3.5" /> Borrador en la casilla de
                operaciones
              </span>
            )}
          </div>
        </div>
        <MeetingProcessControls
          meetingId={meeting.id}
          status={meeting.status}
        />
      </div>

      {!minutes ? (
        <Surface padding="lg">
          <p className="text-sm">
            Todavía no hay minuta.{" "}
            {meeting.transcriptFileId
              ? "La transcripción está vinculada: procesa la reunión para generarla."
              : "Cuando la transcripción de Gemini aparezca en el Drive de operaciones, el ciclo la toma solo; también puedes vincularla a mano."}
          </p>
        </Surface>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Surface padding="lg">
              <h2 className="font-heading mb-3 text-sm font-medium">Resumen</h2>
              <p className="text-sm whitespace-pre-wrap">{minutes.summary}</p>
              {minutes.attendees.length > 0 && (
                <p className="text-muted-foreground mt-4 text-xs">
                  Asistentes:{" "}
                  {minutes.attendees
                    .map((a) => [a.name, a.area].filter(Boolean).join(" · "))
                    .join(", ")}
                </p>
              )}
            </Surface>

            <Surface padding="lg">
              <h2 className="font-heading mb-3 text-sm font-medium">
                Solicitudes propuestas ({items.length})
              </h2>
              <p className="text-muted-foreground mb-4 text-xs">
                Nacen como «propuesta». La aprobación y el paso a Asana llegan
                en la fase siguiente del backlog.
              </p>
              {items.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No se detectaron solicitudes.
                </p>
              ) : (
                <ul className="divide-border divide-y">
                  {items.map((it) => (
                    <li key={it.id} className="py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-medium">
                          <span className="text-muted-foreground mr-2 font-mono text-xs">
                            {it.code}
                          </span>
                          {it.title}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Pill tone={PRIORITY_TONE[it.priority] ?? "slate"}>
                            {it.priority}
                          </Pill>
                          <Pill tone="slate">
                            {ITEM_STATUS_LABEL[it.status] ?? it.status}
                          </Pill>
                        </div>
                      </div>
                      {it.detail && (
                        <p className="text-muted-foreground mt-1 text-sm">
                          {it.detail}
                        </p>
                      )}
                      <p className="text-muted-foreground mt-1.5 text-xs">
                        {[
                          it.area,
                          it.type,
                          it.environment,
                          it.destination
                            ? (DESTINATION_LABEL[it.destination] ??
                              it.destination)
                            : null,
                          it.roadmapCode ??
                            (it.moduleId ? moduleById.get(it.moduleId) : null),
                          it.raisedBy ? `planteó ${it.raisedBy}` : null,
                          it.evidence ? `evidencia: ${it.evidence}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>

            {minutes.topics.length > 0 && (
              <Surface padding="lg">
                <h2 className="font-heading mb-3 text-sm font-medium">Temas</h2>
                <ul className="space-y-2 text-sm">
                  {minutes.topics.map((t, i) => (
                    <li key={i}>
                      <span className="font-medium">{t.title}</span>
                      {t.minute && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          {t.minute}
                        </span>
                      )}
                      {t.detail && (
                        <p className="text-muted-foreground">{t.detail}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </Surface>
            )}
          </div>

          <div className="space-y-6">
            <ListCard title="Acuerdos" items={minutes.agreements} />
            <ListCard
              title="Decisiones pendientes"
              items={minutes.pendingDecisions}
            />
            <Surface padding="lg">
              <h2 className="font-heading mb-3 text-sm font-medium">
                Preguntas abiertas ({questions.length})
              </h2>
              {questions.length === 0 ? (
                <p className="text-muted-foreground text-sm">—</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {questions.map((q) => (
                    <li key={q.id}>
                      <p>{q.question}</p>
                      <p className="text-muted-foreground text-xs">
                        para {q.forWhom ?? "—"}
                        {q.blocks && ` · bloquea ${q.blocks}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>
            <ListCard
              title="Confirmado, sin desarrollo"
              items={minutes.confirmedNoDev}
            />
            {minutes.quotedFigures.length > 0 && (
              <Surface padding="lg">
                <h2 className="font-heading mb-3 text-sm font-medium">
                  Cifras mencionadas
                </h2>
                <ul className="space-y-1.5 text-sm">
                  {minutes.quotedFigures.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Pill
                        tone={c.status === "verificado" ? "emerald" : "amber"}
                      >
                        {c.status}
                      </Pill>
                      <span>
                        {c.text}
                        {c.note && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {c.note}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground mt-3 text-xs">
                  Las cifras quedan como «dicho» hasta que el arquitecto las
                  verifique contra los datos.
                </p>
              </Surface>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Surface padding="lg">
      <h2 className="font-heading mb-3 text-sm font-medium">{title}</h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">—</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span
                aria-hidden
                className="bg-foreground/40 mt-2 size-1 shrink-0 rounded-full"
              />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
      )}
      style={{
        color: `var(--status-${tone})`,
        background: `var(--status-${tone}-bg)`,
      }}
    >
      {children}
    </span>
  );
}
