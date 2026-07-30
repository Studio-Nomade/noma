import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  listServicePackages,
  listServiceSubareas,
  listServicesWithVariants,
} from "@/features/services/queries";
import { ServiceDialog } from "@/features/services/service-dialog";
import { ServicesHub } from "@/features/services/services-hub";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { getLatestRates } from "@/lib/currency/rates";

export const metadata = { title: "Servicios" };

export default async function ServicesPage() {
  const [services, subareas, packages, user, rates] = await Promise.all([
    listServicesWithVariants(),
    listServiceSubareas(),
    listServicePackages(),
    requireUser(),
    getLatestRates(),
  ]);
  const canEdit = roleFor(user.email).canEditCatalog;

  const newButton = canEdit ? (
    <ServiceDialog
      rates={{ ufClp: rates.ufClp, usdClp: rates.usdClp }}
      subareas={subareas}
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

      <ServicesHub
        services={services}
        subareas={subareas}
        packages={packages}
        canEdit={canEdit}
        rates={{ ufClp: rates.ufClp, usdClp: rates.usdClp }}
      />
    </>
  );
}
