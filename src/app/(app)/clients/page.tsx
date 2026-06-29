import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { listClients } from "@/features/clients/queries";
import { ClientDialog } from "@/features/clients/client-dialog";
import { ClientsTable } from "@/features/clients/clients-table";

export const metadata = { title: "Clientes" };

export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <>
      <PageHeader
        title="Clientes"
        description={`${clients.length} ${clients.length === 1 ? "cliente registrado" : "clientes registrados"}`}
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
