import { PageHeader } from "@/components/shared/page-header";
import { DocumentsView } from "@/features/finance/documents-view";

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
      />
      <DocumentsView direction="COMPRA" estado={estado} />
    </>
  );
}
