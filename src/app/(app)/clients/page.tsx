import { Plus, Users, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { listClients } from "@/features/clients/queries";
import { ClientDialog } from "@/features/clients/client-dialog";
import { ClientsTable } from "@/features/clients/clients-table";
import { BulkImportDialog } from "@/features/clients/bulk-import-dialog";

export const metadata = { title: "Clientes" };

export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <>
      <PageHeader
        title="Clientes"
        description={`${clients.length} ${clients.length === 1 ? "cliente registrado" : "clientes registrados"}`}
        action={
          <div className="flex gap-2">
            <BulkImportDialog
              trigger={
                <Button variant="outline">
                  <UploadCloud className="size-4" />
                  Carga masiva
                </Button>
              }
            />
            <ClientDialog
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Nuevo cliente
                </Button>
              }
            />
          </div>
        }
      />

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aún no hay clientes"
          description="Crea tu primer cliente para empezar a registrar proyectos y propuestas."
          action={
            <ClientDialog
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Nuevo cliente
                </Button>
              }
            />
          }
        />
      ) : (
        <ClientsTable clients={clients} />
      )}
    </>
  );
}
