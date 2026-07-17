import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listProjectsWithBrief } from "@/features/briefs/queries";

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
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Proyecto", "Cliente", "Área", "Brief"].map((h) => (
                  <TableHead
                    key={h}
                    className="text-xs tracking-wide uppercase"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.projectId} className="hover:bg-accent/50">
                  <TableCell>
                    <Link
                      href={`/briefs/${r.projectId}`}
                      className="font-medium"
                    >
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.clientName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.area}
                  </TableCell>
                  <TableCell>
                    {r.briefStatus ? (
                      <StatusBadge value={r.briefStatus} size="xs" />
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Sin brief
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
