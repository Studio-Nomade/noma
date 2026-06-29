import { Plus, FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { listProjects } from "@/features/projects/queries";
import { listClients } from "@/features/clients/queries";
import { ProjectDialog } from "@/features/projects/project-dialog";
import { ProjectsTable } from "@/features/projects/projects-table";

export const metadata = { title: "Proyectos" };

export default async function ProjectsPage() {
  const [projects, clients] = await Promise.all([
    listProjects(),
    listClients(),
  ]);
  const clientOptions = clients.map((c) => ({
    id: c.id,
    companyName: c.companyName,
  }));

  const hasClients = clientOptions.length > 0;
  const newButton = hasClients ? (
    <ProjectDialog
      clients={clientOptions}
      trigger={
        <Button>
          <Plus className="size-4" />
          Nuevo proyecto
        </Button>
      }
    />
  ) : null;

  return (
    <>
      <PageHeader
        title="Proyectos"
        description={`${projects.length} ${projects.length === 1 ? "proyecto" : "proyectos"} en total`}
        action={newButton}
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Aún no hay proyectos"
          description={
            hasClients
              ? "Crea tu primer proyecto y vincúlalo a un cliente."
              : "Primero crea un cliente; los proyectos siempre se vinculan a uno."
          }
          action={newButton}
        />
      ) : (
        <ProjectsTable projects={projects} />
      )}
    </>
  );
}
