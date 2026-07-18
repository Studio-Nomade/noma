import { UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { DocumentsView } from "@/features/finance/documents-view";
import { BulkFilesDialog } from "@/features/finance/bulk-files-dialog";

export default async function EgresosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
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
      <DocumentsView direction="COMPRA" estado={estado} />
    </>
  );
}
