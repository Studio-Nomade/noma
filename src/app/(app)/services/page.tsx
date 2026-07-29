import { Plus, Boxes } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { listServices } from "@/features/services/queries";
import { ServiceDialog } from "@/features/services/service-dialog";
import { ServicesList } from "@/features/services/services-list";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";

export const metadata = { title: "Servicios" };

export default async function ServicesPage() {
  const [services, user] = await Promise.all([listServices(), requireUser()]);
  const canEdit = roleFor(user.email).canEditCatalog;

  const newButton = canEdit ? (
    <ServiceDialog
      trigger={
        <Button>
          <Plus className="size-4" />
          Nuevo servicio
        </Button>
      }
    />
  ) : null;

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
        <ServicesList services={services} canEdit={canEdit} />
      )}
    </>
  );
}
