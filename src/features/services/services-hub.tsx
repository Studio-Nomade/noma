"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ServiceSubarea } from "@/db/schema";
import type { Rates } from "@/lib/currency/convert";
import type {
  ServicePackageWithItems,
  ServiceWithVariants,
} from "./queries";
import { ServicesList } from "./services-list";
import { SubareasManager } from "./subareas-manager";
import { PackagesManager } from "./packages-manager";

export function ServicesHub({
  services,
  subareas,
  packages,
  canEdit,
  rates,
}: {
  services: ServiceWithVariants[];
  subareas: ServiceSubarea[];
  packages: ServicePackageWithItems[];
  canEdit: boolean;
  rates: Rates;
}) {
  return (
    <Tabs defaultValue="library" className="space-y-6">
      <TabsList className="h-auto w-full flex-wrap sm:w-fit">
        <TabsTrigger value="library">Servicios</TabsTrigger>
        <TabsTrigger value="packages">Paquetes</TabsTrigger>
        <TabsTrigger value="subareas">Subáreas</TabsTrigger>
      </TabsList>
      <TabsContent value="library">
        <ServicesList
          services={services}
          canEdit={canEdit}
          rates={rates}
          subareas={subareas}
        />
      </TabsContent>
      <TabsContent value="packages">
        <PackagesManager
          packages={packages}
          services={services}
          canEdit={canEdit}
        />
      </TabsContent>
      <TabsContent value="subareas">
        <SubareasManager
          subareas={subareas}
          services={services}
          canEdit={canEdit}
        />
      </TabsContent>
    </Tabs>
  );
}
