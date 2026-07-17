import { PageHeader } from "@/components/shared/page-header";
import { DocumentsView } from "@/features/finance/documents-view";

export default async function IngresosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  return (
    <>
      <PageHeader
        title="Ingresos"
        description="Facturas de venta y boletas emitidas"
      />
      <DocumentsView direction="VENTA" estado={estado} />
    </>
  );
}
