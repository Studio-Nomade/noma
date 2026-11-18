import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ExternalLink, Hand } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import { Surface } from "@/components/shared/surface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getProject } from "@/features/projects/queries";
import {
  getDevTracking,
  type DevTracking,
} from "@/features/dev-tracking/queries";
import { DevBadge, devStatusLabel } from "@/features/dev-tracking/dev-badge";
import {
  PrBars,
  ProgressRing,
  monthLabel,
} from "@/features/dev-tracking/pr-bars";
import { MilestoneStatusSelect } from "@/features/dev-tracking/milestone-status-select";
import { ModuleBallDialog } from "@/features/dev-tracking/module-ball-dialog";
import { LogForm } from "@/features/dev-tracking/log-form";
import { MeetingsTab } from "@/features/dev-tracking/meetings-tab";
import { getDevMeetingsData } from "@/features/dev-tracking/meetings-queries";
import { BacklogBoard } from "@/features/dev-tracking/backlog-board";
import { getBacklogData } from "@/features/dev-tracking/backlog-queries";
import {
  ROADMAP_KINDS,
  ROADMAP_STATUSES,
} from "@/features/dev-tracking/constants";

export const dynamic = "force-dynamic";
// «Crear en Asana» espera ~20 s a la regla del tablero antes de fijar estado.
export const maxDuration = 60;

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}-${m}-${y}`;
}

function todayIso() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
  }).format(new Date());
}

export default async function SeguimientoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [row] = await Promise.all([getProject(id), requireUser()]);
  if (!row) notFound();
  const data = await getDevTracking(id);
  const { project, clientName } = row;

  if (!data) {
    return (
      <>
        <BackLink id={id} />
        <Surface padding="lg">
          <h1 className="font-heading text-xl font-semibold">
            Seguimiento de desarrollo
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Este proyecto todavía no tiene un programa de seguimiento. Se crea
            con el importador (<code>npm run dev-tracking:import</code>) o desde
            la API del arquitecto.
          </p>
        </Surface>
      </>
    );
  }

  const [meetingsData, backlogData] = await Promise.all([
    getDevMeetingsData(data.program.id, data.program.clientId),
    getBacklogData(data.program.id),
  ]);
  const estado = typeof sp.estado === "string" ? sp.estado : "";
  const tipo = typeof sp.tipo === "string" ? sp.tipo : "";
  const mes = typeof sp.mes === "string" ? sp.mes : "";
  const today = todayIso();

  return (
    <>
      <BackLink id={id} />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {data.program.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {clientName} · {project.name} · Seguimiento de desarrollo
            {data.program.sourceUpdatedAt && (
              <>
                {" · "}
                actualizado{" "}
                {data.program.sourceUpdatedAt.toLocaleString("es-CL", {
                  timeZone: "America/Santiago",
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </>
            )}
          </p>
        </div>
        {data.program.asanaProjectGid && (
          <a
            href={`https://app.asana.com/0/${data.program.asanaProjectGid}`}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            Abrir en Asana <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      <Tabs defaultValue="resumen">
        <TabsList
          variant="line"
          className="mb-5 w-full justify-start overflow-x-auto"
        >
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="modulos">Módulos</TabsTrigger>
          <TabsTrigger value="ruta">Hoja de ruta</TabsTrigger>
          <TabsTrigger value="roadmaps">Roadmaps</TabsTrigger>
          <TabsTrigger value="bitacora">Bitácora</TabsTrigger>
          <TabsTrigger value="reuniones">Reuniones</TabsTrigger>
          <TabsTrigger value="backlog">Backlog</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <Resumen data={data} today={today} />
        </TabsContent>
        <TabsContent value="modulos">
          <Modulos data={data} today={today} />
        </TabsContent>
        <TabsContent value="ruta">
          <HojaDeRuta data={data} today={today} />
        </TabsContent>
        <TabsContent value="roadmaps">
          <Roadmaps
            data={data}
            filters={{ estado, tipo, mes }}
            basePath={`/projects/${id}/seguimiento`}
          />
        </TabsContent>
        <TabsContent value="bitacora">
          <Bitacora data={data} />
          <p className="text-muted-foreground mt-6 text-xs">
            ID del programa (para la API del arquitecto):{" "}
            <code className="select-all">{data.program.id}</code>
          </p>
        </TabsContent>
        <TabsContent value="backlog">
          <div className="space-y-6">
            <BacklogBoard
              data={backlogData}
              programId={data.program.id}
              hasAsana={!!data.program.asanaProjectGid}
            />
            <Preguntas questions={backlogData.questions} />
          </div>
        </TabsContent>
        <TabsContent value="reuniones">
          <MeetingsTab
            programId={data.program.id}
            programName={data.program.name}
            projectId={id}
            data={meetingsData}
            today={today}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function BackLink({ id }: { id: string }) {
  return (
    <Link
      href={`/projects/${id}`}
      className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
    >
      <ArrowLeft className="size-4" />
      Volver al proyecto
    </Link>
  );
}

// ── Resumen ──────────────────────────────────────────────────

function Resumen({ data, today }: { data: DevTracking; today: string }) {
  const { summary, modules, prsByMonth } = data;
  const overdue = modules.filter(
    (m) => m.nextFollowUp && m.nextFollowUp < today,
  ).length;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="PR integrados"
          value={summary.totalPrs}
          subtext={`${summary.repos.join(" · ")} · sin promociones`}
        />
        <MetricCard
          label="Roadmaps"
          value={summary.roadmaps}
          subtext={`${summary.roadmapsInProd} en producción`}
        />
        <MetricCard
          label="Hitos en producción"
          value={`${summary.milestonesInProd}/${summary.milestones}`}
          subtext={
            summary.milestonesBlocked
              ? `${summary.milestonesBlocked} bloqueado${summary.milestonesBlocked === 1 ? "" : "s"}`
              : "sin bloqueos"
          }
        />
        <MetricCard
          label="Avance promedio"
          value={`${summary.avgProgress}%`}
          subtext={`${summary.modules} módulos en curso${overdue ? ` · ${overdue} con seguimiento vencido` : ""}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Surface padding="lg" className="lg:col-span-3">
          <h2 className="font-heading mb-4 text-sm font-medium">
            PR integrados por mes
          </h2>
          <PrBars data={prsByMonth} repos={summary.repos} />
        </Surface>
        <Surface padding="lg" className="lg:col-span-2">
          <h2 className="font-heading mb-4 text-sm font-medium">
            Dónde está la pelota
          </h2>
          <ul className="space-y-3">
            {modules.map((m) => (
              <li key={m.id} className="flex items-start gap-3">
                <ProgressRing value={m.progress} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    <span className="text-muted-foreground">{m.code}</span>{" "}
                    {m.name}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    <Hand className="mr-1 inline size-3" />
                    {m.ballOwner ?? "Sin asignar"}
                    {m.nextFollowUp && (
                      <span
                        className={cn(
                          "ml-2",
                          m.nextFollowUp < today && "text-[var(--status-red)]",
                        )}
                      >
                        <CalendarClock className="mr-1 inline size-3" />
                        {fmtDate(m.nextFollowUp)}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
            {modules.length === 0 && (
              <li className="text-muted-foreground text-sm">
                No hay módulos en curso.
              </li>
            )}
          </ul>
        </Surface>
      </div>
    </div>
  );
}

// ── Módulos ──────────────────────────────────────────────────

function Modulos({ data, today }: { data: DevTracking; today: string }) {
  if (data.modules.length === 0) {
    return (
      <Surface padding="lg">
        <p className="text-muted-foreground text-sm">
          No hay módulos en curso.
        </p>
      </Surface>
    );
  }
  return (
    <div className="space-y-6">
      {data.modules.map((m) => {
        const done = m.milestones.filter((h) => h.status === "en_prod").length;
        return (
          <Surface key={m.id} padding="lg" id={`modulo-${m.code}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <ProgressRing value={m.progress} />
                <div>
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">
                    {m.code}
                  </p>
                  <h2 className="font-heading text-lg font-semibold">
                    {m.name}
                  </h2>
                  {m.objective && (
                    <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                      {m.objective}
                    </p>
                  )}
                </div>
              </div>
              <ModuleBallDialog module={m} />
            </div>

            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Inicio" value={fmtDate(m.startDate)} />
              <Field label="Entrega objetivo" value={fmtDate(m.targetDate)} />
              <Field
                label="Próximo seguimiento"
                value={fmtDate(m.nextFollowUp)}
                alert={!!m.nextFollowUp && m.nextFollowUp < today}
              />
              <Field
                label="Hitos"
                value={`${done} de ${m.milestones.length} en producción`}
              />
            </dl>
            {m.criteria && (
              <p className="text-muted-foreground mt-3 text-xs">
                Criterio de avance: {m.criteria}
              </p>
            )}

            <div className="glass-hairline mt-5 rounded-lg p-4">
              <p className="text-xs font-medium tracking-wide uppercase">
                <Hand className="mr-1 inline size-3.5" />
                La pelota está en {m.ballOwner ?? "— sin asignar"}
              </p>
              {m.ballWhat && <p className="mt-1 text-sm">{m.ballWhat}</p>}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="font-heading mb-3 text-sm font-medium">Hitos</h3>
                <ul className="divide-border divide-y">
                  {m.milestones.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{h.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {fmtDate(h.date)}
                          {h.prNumbers.length > 0 &&
                            ` · ${h.prNumbers.join(", ")}`}
                        </p>
                      </div>
                      <MilestoneStatusSelect
                        milestoneId={h.id}
                        value={h.status}
                      />
                    </li>
                  ))}
                  {m.milestones.length === 0 && (
                    <li className="text-muted-foreground py-2 text-sm">
                      Sin hitos definidos.
                    </li>
                  )}
                </ul>
              </div>
              <div className="space-y-5">
                <ListBlock
                  title="En producción"
                  items={m.inProduction}
                  tone="emerald"
                />
                <ListBlock title="Pendientes" items={m.pending} tone="amber" />
              </div>
            </div>
          </Surface>
        );
      })}
    </div>
  );
}

function Field({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </dt>
      <dd className={cn("mt-0.5", alert && "text-[var(--status-red)]")}>
        {value}
      </dd>
    </div>
  );
}

function ListBlock({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "emerald" | "amber";
}) {
  return (
    <div>
      <h3 className="font-heading mb-2 text-sm font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">—</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span
                aria-hidden
                className="mt-1.5 size-1.5 shrink-0 rounded-full"
                style={{ background: `var(--status-${tone})` }}
              />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Hoja de ruta ─────────────────────────────────────────────

function HojaDeRuta({ data, today }: { data: DevTracking; today: string }) {
  const dated = data.modules.filter((m) => m.startDate && m.targetDate);
  if (dated.length === 0) {
    return (
      <Surface padding="lg">
        <p className="text-muted-foreground text-sm">
          Los módulos necesitan fecha de inicio y entrega objetivo para dibujar
          la hoja de ruta.
        </p>
      </Surface>
    );
  }
  const ms = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
  const min = Math.min(...dated.map((m) => ms(m.startDate!)), ms(today));
  const max = Math.max(...dated.map((m) => ms(m.targetDate!)), ms(today));
  const span = Math.max(1, max - min);
  const pct = (d: string) => ((ms(d) - min) / span) * 100;
  const todayPct = pct(today);

  // marcas de mes
  const months: string[] = [];
  const cursor = new Date(min);
  cursor.setUTCDate(1);
  while (cursor.getTime() <= max) {
    months.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return (
    <Surface padding="lg">
      <h2 className="font-heading mb-6 text-sm font-medium">
        Hoja de ruta de los módulos en curso
      </h2>
      <div className="relative">
        <div className="text-muted-foreground relative mb-2 h-4 text-[11px]">
          {months.map((d) => (
            <span
              key={d}
              className="absolute -translate-x-1/2"
              style={{ left: `${pct(d)}%` }}
            >
              {monthLabel(d.slice(0, 7))}
            </span>
          ))}
        </div>
        <div className="relative space-y-3">
          <div
            aria-hidden
            className="absolute top-0 bottom-0 w-px"
            style={{
              left: `${todayPct}%`,
              background: "var(--status-red)",
            }}
          />
          {dated.map((m) => {
            const left = pct(m.startDate!);
            const width = Math.max(1.5, pct(m.targetDate!) - left);
            const late = m.targetDate! < today && m.progress < 100;
            return (
              <div key={m.id} className="relative h-9">
                <div
                  className="absolute top-1 h-7 overflow-hidden rounded-md"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: "var(--status-slate-bg)",
                  }}
                  title={`${m.code} · ${fmtDate(m.startDate)} → ${fmtDate(m.targetDate)} · ${m.progress}%`}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${m.progress}%`,
                      background: late
                        ? "var(--status-red)"
                        : "var(--status-emerald)",
                      opacity: 0.85,
                    }}
                  />
                  <span className="absolute inset-0 flex items-center truncate px-2 text-xs font-medium">
                    {m.code} · {m.progress}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-4 text-xs">
          La línea roja marca hoy ({fmtDate(today)}). Las barras muestran el
          avance sobre el plazo inicio → entrega objetivo.
        </p>
      </div>
    </Surface>
  );
}

// ── Roadmaps ─────────────────────────────────────────────────

function Roadmaps({
  data,
  filters,
  basePath,
}: {
  data: DevTracking;
  filters: { estado: string; tipo: string; mes: string };
  basePath: string;
}) {
  const months = [...new Set(data.roadmaps.map((r) => r.month))].sort();
  const rows = data.roadmaps.filter(
    (r) =>
      (!filters.estado || r.status === filters.estado) &&
      (!filters.tipo || r.kind === filters.tipo) &&
      (!filters.mes || r.month === filters.mes),
  );
  const link = (patch: Partial<typeof filters>) => {
    const q = new URLSearchParams();
    const merged = { ...filters, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return `${basePath}${s ? `?${s}` : ""}#roadmaps`;
  };
  const moduleCodeById = new Map(data.modules.map((m) => [m.id, m.code]));

  return (
    <Surface padding="lg" id="roadmaps">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <FilterGroup
          label="Estado"
          current={filters.estado}
          options={ROADMAP_STATUSES.map((s) => [s, devStatusLabel(s)])}
          href={(v) => link({ estado: v })}
        />
        <FilterGroup
          label="Tipo"
          current={filters.tipo}
          options={ROADMAP_KINDS.map((k) => [k, devStatusLabel(k)])}
          href={(v) => link({ tipo: v })}
        />
        <FilterGroup
          label="Mes"
          current={filters.mes}
          options={months.map((m) => [m, monthLabel(m)])}
          href={(v) => link({ mes: v })}
        />
        <span className="text-muted-foreground ml-auto">
          {rows.length} de {data.roadmaps.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left text-xs tracking-wide uppercase">
            <tr>
              <th className="py-2 pr-3">Código</th>
              <th className="py-2 pr-3">Título</th>
              <th className="py-2 pr-3">Mes</th>
              <th className="py-2 pr-3">Tipo</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 pr-3">Módulo</th>
              <th className="py-2">Asana</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-3 font-medium whitespace-nowrap">
                  {r.code}
                </td>
                <td className="py-2 pr-3">{r.title}</td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {monthLabel(r.month)}
                </td>
                <td className="py-2 pr-3">
                  <DevBadge value={r.kind} size="xs" />
                </td>
                <td className="py-2 pr-3">
                  <DevBadge value={r.status} size="xs" />
                </td>
                <td className="text-muted-foreground py-2 pr-3 whitespace-nowrap">
                  {r.moduleId ? (
                    <a
                      href={`#modulo-${moduleCodeById.get(r.moduleId)}`}
                      className="hover:text-foreground"
                    >
                      {moduleCodeById.get(r.moduleId)}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2">
                  {r.asanaTaskGids.length > 0 ? (
                    <a
                      href={`https://app.asana.com/0/0/${r.asanaTaskGids[0]}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                    >
                      {r.asanaTaskGids.length}{" "}
                      {r.asanaTaskGids.length === 1 ? "tarea" : "tareas"}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      sin rastro
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="text-muted-foreground py-6 text-center"
                >
                  Ningún roadmap calza con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

function FilterGroup({
  label,
  current,
  options,
  href,
}: {
  label: string;
  current: string;
  options: [string, string][];
  href: (value: string) => string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground mr-1">{label}</span>
      <Link
        href={href("")}
        className={cn(
          "rounded-full px-2 py-0.5",
          !current ? "bg-accent font-medium" : "hover:bg-accent/60",
        )}
      >
        Todos
      </Link>
      {options.map(([value, text]) => (
        <Link
          key={value}
          href={href(value)}
          className={cn(
            "rounded-full px-2 py-0.5",
            current === value ? "bg-accent font-medium" : "hover:bg-accent/60",
          )}
        >
          {text}
        </Link>
      ))}
    </div>
  );
}

// ── Bitácora ─────────────────────────────────────────────────

function Bitacora({ data }: { data: DevTracking }) {
  const byDate = new Map<string, DevTracking["log"]>();
  for (const e of data.log) {
    byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  }
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Surface padding="lg" className="lg:col-span-2">
        <h2 className="font-heading mb-4 text-sm font-medium">Bitácora</h2>
        {byDate.size === 0 ? (
          <p className="text-muted-foreground text-sm">Sin anotaciones.</p>
        ) : (
          <ol className="space-y-5">
            {[...byDate.entries()].map(([date, entries]) => (
              <li key={date}>
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  {fmtDate(date)}
                </p>
                <ul className="divide-border divide-y">
                  {entries.map((e) => (
                    <li key={e.id} className="flex gap-3 py-2 text-sm">
                      <span className="text-muted-foreground w-24 shrink-0 text-xs">
                        {e.moduleCode ?? "—"}
                      </span>
                      <span className="flex-1">{e.text}</span>
                      <span className="text-muted-foreground shrink-0 text-[11px]">
                        {e.source}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </Surface>
      <Surface padding="lg">
        <h2 className="font-heading mb-4 text-sm font-medium">Anotar</h2>
        <LogForm
          programId={data.program.id}
          modules={data.modules.map((m) => ({ id: m.id, code: m.code }))}
        />
      </Surface>
    </div>
  );
}

// ── Preguntas abiertas ───────────────────────────────────────

function Preguntas({
  questions,
}: {
  questions: Awaited<ReturnType<typeof getBacklogData>>["questions"];
}) {
  const open = questions.filter((q) => q.status === "abierta");
  if (open.length === 0) return null;
  return (
    <Surface padding="lg">
      <h2 className="font-heading mb-3 text-sm font-medium">
        Preguntas abiertas ({open.length})
      </h2>
      <ul className="divide-border divide-y text-sm">
        {open.map((q) => (
          <li key={q.id} className="py-2">
            <p>{q.question}</p>
            <p className="text-muted-foreground text-xs">
              para {q.forWhom ?? "—"} · desde {fmtDate(q.since)}
              {q.blocks && ` · bloquea ${q.blocks}`}
              {q.source === "claude_code" && " · del arquitecto"}
            </p>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
