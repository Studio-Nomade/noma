import Link from "next/link";
import { CalendarClock, ListChecks, FileSignature } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/currency/format";
import {
  getDashboardMetrics,
  getNextActions,
  getUpcomingDeliveries,
  getDashboardOpportunities,
} from "@/features/dashboard/queries";
import { listProposals } from "@/features/proposals/queries";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { getCurrentTeamMember } from "@/features/team/profile";
import {
  getAnnouncements,
  getUpcomingBirthdays,
} from "@/features/internal-comms/queries";
import { InternalCommsSection } from "@/features/internal-comms/internal-comms-section";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const member = await getCurrentTeamMember(user);
  const [
    metrics,
    nextActions,
    deliveries,
    opportunities,
    proposals,
    announcements,
    birthdays,
  ] = await Promise.all([
    getDashboardMetrics(),
    getNextActions(),
    getUpcomingDeliveries(),
    getDashboardOpportunities(),
    listProposals(),
    getAnnouncements(member?.id ?? null),
    getUpcomingBirthdays(),
  ]);

  const recentProposals = proposals.slice(0, 5);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visión operativa del estudio: pipeline, próximas acciones y entregas."
      />

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Clientes activos"
          value={String(metrics.activeClients)}
        />
        <MetricCard
          label="Proyectos activos"
          value={String(metrics.activeProjects)}
        />
        <MetricCard
          label="Propuestas enviadas"
          value={String(metrics.sentProposals)}
        />
        <MetricCard
          label="Ingresos potenciales"
          value={`${metrics.potentialUf.toLocaleString("es-CL")} UF`}
          subtext="propuestas enviadas"
        />
      </div>

      {/* Pipeline */}
      <InternalCommsSection
        initialAnnouncements={announcements}
        birthdays={birthdays}
        canManage={roleFor(user.email).isAdmin}
      />

      <div className="border-border bg-card mt-8 rounded-xl border p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-medium">
            Pipeline comercial
          </h2>
          <Link
            href="/pipeline"
            className="text-muted-foreground hover:text-foreground text-xs font-medium"
          >
            Ver pipeline completo
          </Link>
        </div>
        {opportunities.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            No hay oportunidades activas.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {opportunities.map((opportunity) => (
              <Link
                key={opportunity.id}
                href={`/projects/${opportunity.id}`}
                className="border-border hover:bg-accent/50 min-w-0 rounded-lg border p-3 transition-colors"
              >
                <p className="truncate text-sm font-medium">
                  {opportunity.name}
                </p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {opportunity.clientName}
                </p>
                <div className="mt-3">
                  <StatusBadge value={opportunity.stage} size="xs" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Próximas acciones */}
        <div className="border-border bg-card rounded-xl border p-6 lg:col-span-2">
          <h2 className="font-heading mb-4 flex items-center gap-2 text-sm font-medium">
            <ListChecks className="size-4" />
            Próximas acciones
          </h2>
          {nextActions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin próximas acciones definidas en proyectos activos.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {nextActions.map((p) => (
                <li key={p.id} className="py-2.5">
                  <Link href={`/projects/${p.id}`} className="block">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      <StatusBadge value={p.commercialStage} size="xs" />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {p.clientName} · {p.area}
                    </p>
                    <p className="mt-0.5 text-sm">→ {p.nextAction}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Próximas entregas */}
        <div className="border-border bg-card rounded-xl border p-6">
          <h2 className="font-heading mb-4 flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="size-4" />
            Próximas entregas
          </h2>
          {deliveries.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin entregas próximas.
            </p>
          ) : (
            <ul className="space-y-2">
              {deliveries.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="hover:bg-accent/50 flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {p.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {p.clientName}
                      </span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {p.deliveryDate}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Propuestas recientes */}
      <div className="border-border bg-card mt-6 rounded-xl border p-6">
        <h2 className="font-heading mb-4 flex items-center gap-2 text-sm font-medium">
          <FileSignature className="size-4" />
          Propuestas recientes
        </h2>
        {recentProposals.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aún no hay propuestas.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {recentProposals.map((p) => (
              <li key={p.id} className="py-2.5">
                <Link
                  href={`/proposals/${p.id}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {p.title}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {p.clientName ?? "—"} · v{p.version}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm">
                      {formatMoney(
                        p.estimatedValueAmount,
                        p.estimatedValueCurrency ?? "UF",
                      )}
                    </span>
                    <StatusBadge value={p.status} size="xs" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
