import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Activity } from "lucide-react";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visión operativa del estudio: pipeline, próximas acciones y entregas."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Clientes activos" value="—" />
        <MetricCard label="Proyectos activos" value="—" />
        <MetricCard label="Propuestas enviadas" value="—" />
        <MetricCard label="Ingresos potenciales" value="—" subtext="en UF" />
      </div>

      <div className="mt-8">
        <EmptyState
          icon={Activity}
          title="El dashboard operativo llega en la Fase 5"
          description="Aquí se mostrarán próximas acciones, próximas entregas, propuestas recientes y actividad del equipo."
        />
      </div>
    </>
  );
}
