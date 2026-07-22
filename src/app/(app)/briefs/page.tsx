import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { listProjectsWithBrief } from "@/features/briefs/queries";
import { BriefsTable } from "@/features/briefs/briefs-table";

export const metadata = { title: "Briefs" };

export default async function BriefsPage() {
  const rows = await listProjectsWithBrief();

  return (
    <>
      <PageHeader
        title="Briefs"
        description="Levantamiento estructurado por proyecto (general + preguntas por área)."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aún no hay proyectos"
          description="Crea un proyecto para poder levantar su brief."
        />
      ) : (
        <BriefsTable rows={rows} />
      )}
    </>
  );
}
