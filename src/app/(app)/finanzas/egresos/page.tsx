import { UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { DocumentsView } from "@/features/finance/documents-view";
import { BulkFilesDialog } from "@/features/finance/bulk-files-dialog";

export default async function EgresosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; page?: string; pageSize?: string }>;
}) {
  const { estado, page: rawPage, pageSize: rawPageSize } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const pageSize = [20, 50, 100, 200].includes(Number(rawPageSize))
    ? Number(rawPageSize)
    : 20;
  return (
    <>
      <PageHeader
        title="Egresos"
        description="Facturas de compra y gastos de proveedores"
        action={
          <BulkFilesDialog
            direction="COMPRA"
            trigger={
              <Button variant="outline">
                <UploadCloud className="size-4" />
                Cargar PDF/XML
              </Button>
            }
          />
        }
      />
      <DocumentsView
        direction="COMPRA"
        estado={estado}
        page={page}
        pageSize={pageSize}
      />
    </>
  );
}
