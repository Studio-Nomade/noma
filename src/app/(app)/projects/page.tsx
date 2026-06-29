import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FolderKanban } from "lucide-react";

export const metadata = { title: "Proyectos" };

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Eje central: estado operativo, etapa comercial y próximas acciones."
      />
      <EmptyState
        icon={FolderKanban}
        title="Aún no hay proyectos"
        description="El módulo de proyectos se construye en la Fase 2: vincular cliente, área, estado, etapa comercial y links."
      />
    </>
  );
}
