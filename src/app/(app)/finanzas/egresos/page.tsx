import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { DocumentsView } from "@/features/finance/documents-view";
import { BulkFilesDialog } from "@/features/finance/bulk-files-dialog";
import { cn } from "@/lib/utils";

export default async function EgresosPage({
  searchParams,
}: {
  searchParams: Promise<{
    estado?: string;
    page?: string;
    pageSize?: string;
    vista?: string;
  }>;
}) {
  const {
    estado,
    page: rawPage,
    pageSize: rawPageSize,
    vista = "registro",
  } = await searchParams;
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
      <div className="border-border mb-5 flex gap-1 border-b">
        {[
          ["registro", "Registro de Compras"],
          ["cxp", "Cuentas por pagar"],
          ["honorarios", "Honorarios"],
          ["boletas", "Boletas"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/finanzas/egresos?vista=${key}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              vista === key
                ? "border-foreground font-medium"
                : "text-muted-foreground border-transparent",
            )}
          >
            {label}
          </Link>
        ))}
      </div>
      <DocumentsView
        direction="COMPRA"
        estado={estado}
        page={page}
        pageSize={pageSize}
        types={
          vista === "honorarios"
            ? ["BOLETA_HONORARIOS"]
            : vista === "boletas"
              ? ["BOLETA"]
              : undefined
        }
        statuses={
          vista === "cxp" ? ["EMITIDA", "PARCIAL", "VENCIDA"] : undefined
        }
        baseHref={`/finanzas/egresos?vista=${vista}`}
      />
    </>
  );
}
