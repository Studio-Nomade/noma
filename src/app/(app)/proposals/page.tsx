import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FileSignature } from "lucide-react";

export const metadata = { title: "Propuestas" };

export default function ProposalsPage() {
  return (
    <>
      <PageHeader
        title="Propuestas"
        description="Cotizaciones y propuestas comerciales por secciones editables."
      />
      <EmptyState
        icon={FileSignature}
        title="Aún no hay propuestas"
        description="El módulo de propuestas se construye en la Fase 4: selección de servicios, secciones editables y estados (IA preparada para fase futura)."
      />
    </>
  );
}
