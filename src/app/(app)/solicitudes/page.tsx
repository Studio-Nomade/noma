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
import { formatDate } from "@/features/finance/helpers";
import { getRetainerHealth } from "@/features/retainers/queries";

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
  const [{ rows, total }, options, health] = await Promise.all([
    listRequests(filters, { page, pageSize }),
    getRequestFilterOptions(),
    getRetainerHealth(),
  ]);

  return (
    <>
      <PageHeader
        title="Solicitudes"
        description="Solicitudes recibidas por el agente de WhatsApp y su seguimiento operativo."
      />

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
                    {item.unit === "hours" ? "horas" : "entregables"} disponibles
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
                        value={SCOPE_LABELS[request.scopeClass] ?? "Por revisar"}
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
