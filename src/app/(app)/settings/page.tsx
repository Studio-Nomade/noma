import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Settings } from "lucide-react";

export const metadata = { title: "Configuración" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Configuración"
        description="Datos de Studio Nomade, equipo interno y plantilla de condiciones."
      />
      <EmptyState
        icon={Settings}
        title="Configuración en construcción"
        description="Datos del estudio, equipo y condiciones comerciales por defecto se habilitan junto al modelo de datos."
      />
    </>
  );
}
