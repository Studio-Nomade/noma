import { notFound } from "next/navigation";
import { CalendarClock, FileCheck2, Link2Off, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  EmployeeDocumentUpload,
  EmployeeIdentityLink,
  TimeOffReview,
} from "@/features/people/people-manager-actions";
import { getPeopleDashboard } from "@/features/people/portal";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { AREA_LABELS, type Area } from "@/types/enums";

export const metadata = { title: "Personas" };

export default async function PeopleDashboardPage() {
  const user = await requireUser();
  if (!roleFor(user.email).canManagePeople) notFound();
  const dashboard = await getPeopleDashboard();
  const maxArea = Math.max(1, ...dashboard.areas.map((item) => item.value));

  return (
    <>
      <PageHeader
        title="Personas"
        description="Salud general del equipo, expedientes y solicitudes pendientes."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Users}
          label="Equipo activo"
          value={dashboard.stats.active}
        />
        <Stat
          icon={CalendarClock}
          label="Solicitudes pendientes"
          value={dashboard.stats.pendingTimeOff}
        />
        <Stat
          icon={FileCheck2}
          label="Documentos cargados"
          value={dashboard.documentStats.reduce(
            (total, item) => total + item.total,
            0,
          )}
        />
        <Stat
          icon={Link2Off}
          label="Fichas por vincular"
          value={dashboard.stats.unlinked}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="glass rounded-xl p-5">
          <h2 className="font-heading font-medium">Distribución por área</h2>
          <div className="mt-5 space-y-4">
            {dashboard.areas.map((item) => (
              <div key={item.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{AREA_LABELS[item.name as Area] ?? item.name}</span>
                  <span className="text-muted-foreground">{item.value}</span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-[rgb(var(--ambient-1))]"
                    style={{ width: `${(item.value / maxArea) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {!dashboard.areas.length && (
              <p className="text-muted-foreground text-sm">
                Sin datos todavía.
              </p>
            )}
          </div>
        </section>

        <section className="glass rounded-xl p-5">
          <h2 className="font-heading font-medium">Solicitudes por resolver</h2>
          <div className="mt-4 space-y-3">
            {dashboard.pendingTimeOff.map((request) => (
              <div
                key={request.id}
                className="border-border rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {request.employeeName}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {request.startDate} → {request.endDate} ·{" "}
                      {Number(request.days)} días
                    </p>
                  </div>
                  <TimeOffReview id={request.id} />
                </div>
              </div>
            ))}
            {!dashboard.pendingTimeOff.length && (
              <p className="text-muted-foreground text-sm">
                No hay solicitudes pendientes.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="glass mt-5 overflow-hidden rounded-xl">
        <div className="border-border border-b px-5 py-4">
          <h2 className="font-heading font-medium">
            Equipo y acceso al portal
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Vincula cada ficha laboral con su cuenta de Studio Nomade.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr>
                <th className="px-5 py-3">Colaborador</th>
                <th className="px-5 py-3">Área</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Portal</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {dashboard.employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-5 py-3">
                    <span className="block font-medium">{employee.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {employee.roleTitle}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {employee.area ? AREA_LABELS[employee.area] : "Sin área"}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge value={employee.status} size="xs" />
                  </td>
                  <td className="px-5 py-3">
                    {employee.linked ? (
                      <span className="text-xs text-[var(--status-green)]">
                        Habilitado
                      </span>
                    ) : (
                      <EmployeeIdentityLink
                        employeeId={employee.id}
                        members={dashboard.members}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-5">
        <EmployeeDocumentUpload employees={dashboard.employees} />
      </div>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">{label}</span>
        <Icon className="text-muted-foreground size-4" />
      </div>
      <div className="font-heading mt-3 text-3xl">{value}</div>
    </div>
  );
}
