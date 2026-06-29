import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Library } from "lucide-react";

export const metadata = { title: "Documentación" };

export default function ContextDocsPage() {
  return (
    <>
      <PageHeader
        title="Contexto y documentación"
        description="Documentos del estudio: presupuestos, SLA, procesos y plantillas."
      />
      <EmptyState
        icon={Library}
        title="Sin documentos aún"
        description="Se construye en la Fase 6: carga de archivos (Excel/PDF) a almacenamiento con categorías y tags."
      />
    </>
  );
}
