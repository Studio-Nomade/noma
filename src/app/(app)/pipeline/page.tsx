import { Plus, KanbanSquare } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  getPipelinePanelData,
  listProjects,
  listTeamMembers,
} from "@/features/projects/queries";
import { listClients } from "@/features/clients/queries";
import { ProjectDialog } from "@/features/projects/project-dialog";
import { PipelineBoard } from "@/features/projects/pipeline-board";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const [projects, clients, team] = await Promise.all([
    listProjects(),
    listClients(),
    listTeamMembers(),
  ]);
  const clientOptions = clients.map((c) => ({
    id: c.id,
    companyName: c.companyName,
  }));
  const hasClients = clientOptions.length > 0;
  const panelData = await getPipelinePanelData(projects);

  const newButton = hasClients ? (
    <ProjectDialog
      clients={clientOptions}
      teamMembers={team}
      trigger={
        <Button>
          <Plus className="size-4" />
          Nueva oportunidad
        </Button>
      }
    />
  ) : null;

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Oportunidades comerciales organizadas por etapa."
        action={newButton}
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title="Sin oportunidades aún"
          description={
            hasClients
              ? "Crea una oportunidad y vincúlala a un cliente para empezar a moverla por el pipeline."
              : "Primero crea un cliente; las oportunidades siempre se vinculan a uno."
          }
          action={newButton}
        />
      ) : (
        <PipelineBoard projects={projects} panelData={panelData} team={team} />
      )}
    </>
  );
}
