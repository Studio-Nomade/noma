import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Boxes } from "lucide-react";

export const metadata = { title: "Servicios" };

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        title="Biblioteca de servicios"
        description="Servicios del estudio por área, con entregables, tiempos y precios en UF."
      />
      <EmptyState
        icon={Boxes}
        title="Aún no hay servicios"
        description="El módulo de servicios se construye en la Fase 2. Ejecuta el seed para cargar servicios demo."
      />
    </>
  );
}
