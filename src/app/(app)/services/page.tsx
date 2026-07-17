import { Plus, Boxes } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { listServices } from "@/features/services/queries";
import { ServiceDialog } from "@/features/services/service-dialog";
import { ServicesList } from "@/features/services/services-list";

export const metadata = { title: "Servicios" };

export default async function ServicesPage() {
  const services = await listServices();

  const newButton = (
    <ServiceDialog
      trigger={
        <Button>
          <Plus className="size-4" />
          Nuevo servicio
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader
        title="Biblioteca de servicios"
        description={`${services.length} ${services.length === 1 ? "servicio" : "servicios"} · precios referenciales por área`}
        action={newButton}
      />

      {services.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Aún no hay servicios"
          description="Crea servicios o ejecuta el seed para cargar la biblioteca demo."
          action={newButton}
        />
      ) : (
        <ServicesList services={services} />
      )}
    </>
  );
}
