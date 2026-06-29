import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Users } from "lucide-react";

export const metadata = { title: "Clientes" };

export default function ClientsPage() {
  return (
    <>
      <PageHeader
        title="Clientes"
        description="Base de datos de clientes y prospectos del estudio."
      />
      <EmptyState
        icon={Users}
        title="Aún no hay clientes"
        description="El módulo de clientes se construye en la Fase 2: crear, editar y ver clientes con sus proyectos asociados."
      />
    </>
  );
}
