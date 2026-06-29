import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FileText } from "lucide-react";

export const metadata = { title: "Briefs" };

export default function BriefsPage() {
  return (
    <>
      <PageHeader
        title="Briefs"
        description="Levantamiento estructurado por área (general + preguntas específicas)."
      />
      <EmptyState
        icon={FileText}
        title="Aún no hay briefs"
        description="El módulo de briefs se construye en la Fase 3, con formularios por área."
      />
    </>
  );
}
