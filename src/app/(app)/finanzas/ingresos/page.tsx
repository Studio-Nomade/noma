import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { DocumentsView } from "@/features/finance/documents-view";
import { BulkFilesDialog } from "@/features/finance/bulk-files-dialog";
import { InvoiceRegistry } from "@/features/finance/invoices-dte/invoice-registry";
import { cn } from "@/lib/utils";
import type { DocumentDirection, FinDocumentType } from "@/types/enums";

export default async function IngresosPage({
  searchParams,
}: {
    searchParams: Promise<{
      estado?: string;
      page?: string;
      pageSize?: string;
      vista?: string;
      libro?: string;
    }>;
}) {
  const {
    estado,
    page: rawPage,
    pageSize: rawPageSize,
    vista = "registro",
    libro = "ventas",
  } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const pageSize = [20, 50, 100, 200].includes(Number(rawPageSize))
    ? Number(rawPageSize)
    : 20;
  const views = [
    ["registro", "Registro"],
    ["sin-nv", "Por asignar NV"],
    ["cxc", "Por cobrar"],
    ["reclamadas", "Reclamadas"],
    ["libros", "Libros"],
  ] as const;
  const books: Record<
    string,
    { label: string; direction: DocumentDirection; types: FinDocumentType[] }
  > = {
    ventas: {
      label: "Registro de Ventas",
      direction: "VENTA",
      types: ["FACTURA_VENTA", "NOTA_CREDITO", "NOTA_DEBITO"],
    },
    compras: {
      label: "Registro de Compras",
      direction: "COMPRA",
      types: ["FACTURA_COMPRA", "NOTA_CREDITO", "NOTA_DEBITO"],
    },
    honorarios: {
      label: "Honorarios de terceros",
      direction: "COMPRA",
      types: ["BOLETA_HONORARIOS"],
    },
    boletas: {
      label: "Boletas",
      direction: "VENTA",
      types: ["BOLETA"],
    },
  };
  const activeBook = books[libro] ?? books.ventas;
  return (
    <>
      <PageHeader
        title="Ingresos"
        description="Facturas de venta y boletas emitidas"
        action={
          <BulkFilesDialog
            direction="VENTA"
            trigger={
              <Button variant="outline">
                <UploadCloud className="size-4" />
                Cargar PDF/XML
              </Button>
            }
          />
        }
      />
      <div className="border-border mb-5 flex flex-wrap gap-1 border-b">
        {views.map(([key, label]) => (
          <Link
            key={key}
            href={`/finanzas/ingresos?vista=${key}`}
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
      {vista === "sin-nv" ? (
        <InvoiceRegistry unassigned />
      ) : vista === "cxc" ? (
        <InvoiceRegistry status="Por cobrar" />
      ) : vista === "reclamadas" ? (
        <InvoiceRegistry status="Reclamada" />
      ) : vista === "libros" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(books).map(([key, book]) => (
              <Link
                key={key}
                href={`/finanzas/ingresos?vista=libros&libro=${key}`}
                className={cn(
                  "rounded-full px-3 py-1 text-xs",
                  libro === key
                    ? "bg-foreground text-background"
                    : "bg-accent text-muted-foreground",
                )}
              >
                {book.label}
              </Link>
            ))}
          </div>
          <DocumentsView
            direction={activeBook.direction}
            estado={estado}
            page={page}
            pageSize={pageSize}
            types={activeBook.types}
            baseHref={`/finanzas/ingresos?vista=libros&libro=${libro}`}
          />
        </>
      ) : (
        <DocumentsView
          direction="VENTA"
          estado={estado}
          page={page}
          pageSize={pageSize}
        />
      )}
    </>
  );
}
