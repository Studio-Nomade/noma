import { BriefcaseBusiness, Users } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { listEmployees } from "@/features/people/employees";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";

export const metadata = { title: "Colaboradores" };

export default async function CollaboratorsPage() {
  const user = await requireUser();
  if (!roleFor(user.email).canPeople) notFound();
  const employees = await listEmployees();

  return (
    <>
      <PageHeader
        title="Colaboradores"
        description="Ficha laboral y administrativa del equipo, separada de remuneraciones y pagos."
      />
      {employees.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {employees.map((employee) => (
            <article key={employee.id} className="glass rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-heading truncate font-medium">
                    {employee.name}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {employee.roleTitle}
                  </p>
                </div>
                <StatusBadge value={employee.status} size="xs" />
              </div>
              <div className="text-muted-foreground mt-4 flex items-center gap-2 text-xs">
                <BriefcaseBusiness className="size-3.5" />
                {employee.area || "Área por definir"}
              </div>
              <p className="text-muted-foreground mt-4 border-t pt-3 text-xs">
                Expediente de contratos, anexos, vacaciones y licencias: próxima
                etapa.
              </p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="Aún no hay colaboradores"
          description="Las fichas aparecerán aquí una vez creadas desde el maestro laboral."
        />
      )}
    </>
  );
}
import { notFound } from "next/navigation";
