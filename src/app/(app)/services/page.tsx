import { Plus, Boxes } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { listServices } from "@/features/services/queries";
import { getLatestRates } from "@/lib/currency/rates";
import { ServiceDialog } from "@/features/services/service-dialog";
import { ServicesList } from "@/features/services/services-list";

export const metadata = { title: "Servicios" };

export default async function ServicesPage() {
  const [services, rates] = await Promise.all([
    listServices(),
    getLatestRates(),
  ]);

  // Subáreas ya usadas por área, para sugerirlas en el datalist del formulario.
  const subareasByArea = services.reduce<Record<string, string[]>>(
    (acc, service) => {
      if (!service.subarea) return acc;
      const list = (acc[service.area] ??= []);
      if (!list.includes(service.subarea)) list.push(service.subarea);
      return acc;
    },
    {},
  );

  const newButton = (
    <ServiceDialog
      rates={rates}
      subareasByArea={subareasByArea}
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
        <ServicesList
          services={services}
          rates={rates}
          subareasByArea={subareasByArea}
        />
      )}
    </>
  );
}
