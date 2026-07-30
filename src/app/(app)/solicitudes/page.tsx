import Link from "next/link";
import { ExternalLink, Inbox, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlPagination } from "@/components/shared/url-pagination";
import {
  getRequestFilterOptions,
  listRequests,
} from "@/features/bot/requests-queries";
import { getBotAnalytics } from "@/features/bot/analytics";
import { formatDate } from "@/features/finance/helpers";
import { getRetainerHealth } from "@/features/retainers/queries";
import { requireUser } from "@/lib/auth";

const SCOPE_LABELS: Record<string, string> = {
  in_scope: "Dentro de alcance",
  additional: "Adicional",
  unknown: "Por revisar",
};
const STATUS_LABELS: Record<string, string> = {
  captured: "Capturada",
  pending: "Pendiente",
  in_asana: "En Asana",
  closed: "Cerrada",
};

export const metadata = { title: "Solicitudes" };

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Gating explícito: las métricas operativas solo se resuelven dentro de la
  // sesión de equipo protegida por el layout de la aplicación.
  await requireUser();
  const params = await searchParams;
  const text = (key: string) =>
    typeof params[key] === "string" ? params[key] : undefined;
  const page = Math.max(1, Number(text("page")) || 1);
  const pageSize = [20, 50, 100].includes(Number(text("pageSize")))
    ? Number(text("pageSize"))
    : 20;
  const from = validDate(text("from"), false);
  const to = validDate(text("to"), true);
  const filters = {
    clientId: text("clientId"),
    projectId: text("projectId"),
    scopeClass: text("scopeClass"),
    status: text("status"),
    search: text("search"),
    from,
    to,
  };
  const analyticsFrom =
    from ?? new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const analyticsTo = to ?? new Date();
  const [{ rows, total }, options, health, analytics] = await Promise.all([
    listRequests(filters, { page, pageSize }),
    getRequestFilterOptions(),
    getRetainerHealth(),
    getBotAnalytics({
      clientId: filters.clientId,
      from: analyticsFrom,
      to: analyticsTo,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Solicitudes"
        description="Solicitudes recibidas por el agente de WhatsApp y su seguimiento operativo."
      />

      <section className="mb-5" aria-labelledby="analytics-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2
              id="analytics-title"
              className="font-heading text-base font-medium"
            >
              Analítica operativa
            </h2>
            <p className="text-muted-foreground text-xs">
              El rango y cliente se controlan con los filtros de esta página.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Solicitudes"
            value={String(analytics.totals.requests)}
          />
          <MetricCard
            label="Adicionales"
            value={`${analytics.totals.additionalRate}%`}
          />
          <MetricCard
            label="Primera respuesta"
            value={formatMinutes(analytics.totals.averageResponseMinutes)}
          />
          <MetricCard
            label="Hasta Asana"
            value={formatMinutes(analytics.totals.averageAsanaMinutes)}
          />
          <MetricCard
            label="Precisión de alcance"
            value={
              analytics.totals.classificationAccuracy === null
                ? "Sin muestra"
                : `${analytics.totals.classificationAccuracy}%`
            }
            detail={`${analytics.totals.corrected} correcciones`}
          />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <BreakdownCard
            title="Carga por cliente"
            rows={analytics.byClient.slice(0, 6)}
          />
          <BreakdownCard
            title="Evolución mensual"
            rows={analytics.monthly.map((item) => ({
              id: item.period,
              name: item.period,
              requests: item.requests,
              additional: item.additional,
            }))}
          />
          <BreakdownCard
            title="Tipos más frecuentes"
            rows={analytics.topTypes.map((item) => ({
              id: item.name,
              name: item.name,
              requests: item.requests,
              additional: 0,
            }))}
            showAdditional={false}
          />
          <BreakdownCard
            title="Carga por proyecto"
            rows={analytics.byProject.slice(0, 6)}
          />
          <BreakdownCard
            title="Carga por área"
            rows={analytics.byArea.map((item) => ({
              id: item.name,
              ...item,
            }))}
          />
          <BreakdownCard
            title="Recurrencia semanal"
            rows={analytics.weekly.slice(-8).map((item) => ({
              id: item.period,
              name: item.period,
              requests: item.requests,
              additional: 0,
            }))}
            showAdditional={false}
          />
        </div>
      </section>

      {health.length > 0 && (
        <section className="mb-5">
          <h2 className="font-heading mb-3 text-sm font-medium">
            Salud de retainers · período actual
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {health.map((item) => {
              const quota = Number(item.quota ?? 0);
              const remaining = Number(item.remaining ?? quota);
              const additionalRate = item.requests
                ? Math.round((item.additional / item.requests) * 100)
                : 0;
              return (
                <div key={item.retainerId} className="glass rounded-xl p-4">
                  <div className="font-medium">{item.clientName}</div>
                  <div className="text-muted-foreground mt-1 text-sm">
                    {remaining} de {quota}{" "}
                    {item.unit === "hours" ? "horas" : "entregables"}{" "}
                    disponibles
                  </div>
                  <div className="text-muted-foreground mt-2 text-xs">
                    {additionalRate}% solicitudes adicionales este mes
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <form className="glass mb-5 grid gap-3 rounded-xl p-4 md:grid-cols-2 xl:grid-cols-6">
        <label className="relative md:col-span-2 xl:col-span-2">
          <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
          <input
            name="search"
            defaultValue={filters.search}
            placeholder="Buscar solicitud, cliente o proyecto…"
            className="border-input bg-background h-9 w-full rounded-md border pr-3 pl-9 text-sm"
          />
        </label>
        <FilterSelect name="clientId" value={filters.clientId} label="Clientes">
          {options.clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          name="projectId"
          value={filters.projectId}
          label="Proyectos"
        >
          {options.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </FilterSelect>
        <button className="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm font-medium md:col-span-2 xl:col-span-1">
          Filtrar
        </button>
        <FilterSelect
          name="scopeClass"
          value={filters.scopeClass}
          label="Todos los alcances"
        >
          {Object.entries(SCOPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          name="status"
          value={filters.status}
          label="Todos los estados"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </FilterSelect>
        <input
          type="date"
          name="from"
          aria-label="Desde"
          defaultValue={text("from")}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        />
        <input
          type="date"
          name="to"
          aria-label="Hasta"
          defaultValue={text("to")}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        />
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No hay solicitudes"
          description="Cuando el agente capture una solicitud, aparecerá aquí."
        />
      ) : (
        <div className="glass overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Solicitud</th>
                  <th className="px-4 py-3 font-medium">Cliente / proyecto</th>
                  <th className="px-4 py-3 font-medium">Alcance</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Remitente</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Asana</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rows.map((request) => (
                  <tr key={request.id} className="hover:bg-muted/40">
                    <td className="max-w-80 px-4 py-3">
                      <Link
                        href={`/solicitudes/${request.id}`}
                        className="font-medium hover:underline"
                      >
                        {request.summary || request.rawText}
                      </Link>
                      {request.scopeReason && (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          {request.scopeReason}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">{request.clientName}</span>
                      <span className="text-muted-foreground text-xs">
                        {request.projectName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        value={
                          SCOPE_LABELS[request.scopeClass] ?? "Por revisar"
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        value={STATUS_LABELS[request.status] ?? request.status}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">
                        {request.senderName ?? "Remitente revocado"}
                      </span>
                      {request.senderProfile && (
                        <span className="text-muted-foreground text-xs">
                          {request.senderProfile}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(request.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {request.asanaUrl ? (
                        <a
                          href={request.asanaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          Abrir <ExternalLink className="size-3.5" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-border border-t px-4">
            <UrlPagination page={page} pageSize={pageSize} total={total} />
          </div>
        </div>
      )}
    </>
  );
}

function validDate(value: string | undefined, endOfDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function FilterSelect({
  name,
  value,
  label,
  children,
}: {
  name: string;
  value?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={value ?? ""}
      className="border-input bg-background h-9 rounded-md border px-3 text-sm"
    >
      <option value="">{label}</option>
      {children}
    </select>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-heading mt-1 text-2xl">{value}</div>
      {detail && (
        <div className="text-muted-foreground mt-1 text-xs">{detail}</div>
      )}
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  showAdditional = true,
}: {
  title: string;
  rows: Array<{
    id: string;
    name: string;
    requests: number;
    additional: number;
  }>;
  showAdditional?: boolean;
}) {
  const max = Math.max(1, ...rows.map((row) => row.requests));
  return (
    <div className="glass rounded-xl p-4">
      <h3 className="font-heading text-sm font-medium">{title}</h3>
      {rows.length ? (
        <div className="mt-3 space-y-3">
          {rows.map((row) => (
            <div key={row.id}>
              <div className="flex justify-between gap-3 text-xs">
                <span className="truncate">{row.name}</span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {row.requests}
                  {showAdditional && row.additional
                    ? ` · ${row.additional} adicionales`
                    : ""}
                </span>
              </div>
              <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{
                    width: `${Math.max(4, (row.requests / max) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground mt-3 text-sm">
          Sin datos en este período.
        </p>
      )}
    </div>
  );
}

function formatMinutes(value: number | null) {
  if (value === null) return "Sin muestra";
  if (value < 60) return `${Math.round(value)} min`;
  return `${Math.round((value / 60) * 10) / 10} h`;
}
