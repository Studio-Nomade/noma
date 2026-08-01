import Link from "next/link";
import { FlaskConical, FolderKanban, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { listClients } from "@/features/clients/queries";
import { EmailStudioProjectDialog } from "@/features/email-studio/project-dialog";
import { EmailStudioProjectHub } from "@/features/email-studio/project-hub";
import {
  listEmailStudioProjectOptions,
  listEmailStudioProjects,
} from "@/features/email-studio/project-queries";

export const metadata = { title: "Email Studio" };

export default async function EmailStudioPage() {
  const [studioProjects, clients, nomaProjects] = await Promise.all([
    listEmailStudioProjects(),
    listClients(),
    listEmailStudioProjectOptions(),
  ]);

  const clientOptions = clients.map((client) => ({
    id: client.id,
    companyName: client.companyName,
  }));
  const canCreate = clientOptions.length > 0;
  const createButton = canCreate ? (
    <EmailStudioProjectDialog
      clients={clientOptions}
      projects={nomaProjects}
      trigger={
        <Button>
          <Plus />
          Nuevo proyecto
        </Button>
      }
    />
  ) : null;

  return (
    <>
      <PageHeader
        title="Email Studio"
        description="Organiza cada desarrollo de correo por cliente y proyecto."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              render={<Link href="/email-studio/lab" />}
              nativeButton={false}
              variant="outline"
            >
              <FlaskConical />
              Laboratorio
            </Button>
            {createButton}
          </div>
        }
      />

      {studioProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Aún no hay proyectos de correo"
          description={
            canCreate
              ? "Crea el primer espacio para organizar su diseño, assets y HTML."
              : "Primero registra un cliente en Noma para crear proyectos de correo."
          }
          action={
            createButton ?? (
              <Button render={<Link href="/clients" />} nativeButton={false}>
                Ir a clientes
              </Button>
            )
          }
        />
      ) : (
        <EmailStudioProjectHub projects={studioProjects} />
      )}
    </>
  );
}
