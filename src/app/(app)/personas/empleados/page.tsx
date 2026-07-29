import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/currency/format";
import { listEmployees } from "@/features/people/employees";
import { EmployeeForm } from "@/features/people/employee-form";
import { PeopleTabs } from "@/features/people/people-tabs";

export default async function EmployeesPage() {
  const employees = await listEmployees();
  return (
    <>
      <PeopleTabs current="employees" />
      <PageHeader
        title="Empleados"
        description="Maestro laboral base para futuras liquidaciones y remuneraciones"
      />
      <div className="glass-solid mb-6 overflow-x-auto rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-border border-b text-left text-xs">
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Cargo / área</th>
              <th className="px-4 py-3 text-right">Sueldo base</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} className="border-border/60 border-b">
                <td className="px-4 py-3">
                  <span className="block font-medium">{employee.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {employee.rut}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {employee.roleTitle}
                  {employee.area ? ` · ${employee.area}` : ""}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatMoney(
                    employee.baseSalaryAmount,
                    employee.baseSalaryCurrency,
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge value={employee.status} size="xs" />
                </td>
              </tr>
            ))}
            {!employees.length && (
              <tr>
                <td
                  colSpan={4}
                  className="text-muted-foreground px-4 py-8 text-center"
                >
                  Aún no hay empleados registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <EmployeeForm />
      <p className="text-muted-foreground mt-3 text-xs">
        Esta base no calcula nómina, cotizaciones ni liquidaciones. Es el punto
        de extensión para un módulo laboral futuro.
      </p>
    </>
  );
}
