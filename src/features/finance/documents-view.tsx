import Link from "next/link";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { DocumentDirection } from "@/types/enums";
import { getDocuments } from "./queries";
import { DocumentsTable } from "./documents-table";
import { UrlPagination } from "@/components/shared/url-pagination";

const ESTADOS = [
  "TODOS",
  "EMITIDA",
  "PARCIAL",
  "VENCIDA",
  "PAGADA",
  "CONCILIADA",
  "ANULADA",
];

export async function DocumentsView({
  direction,
  estado,
  page,
  pageSize,
}: {
  direction: DocumentDirection;
  estado?: string;
  page: number;
  pageSize: number;
}) {
  const { rows, total } = await getDocuments(direction, {
    estado,
    page,
    pageSize,
  });
  const base =
    direction === "VENTA" ? "/finanzas/ingresos" : "/finanzas/egresos";
  const contactoLabel = direction === "VENTA" ? "Cliente" : "Proveedor";

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-1">
        {ESTADOS.map((e) => {
          const active = (estado ?? "TODOS") === e;
          return (
            <Link
              key={e}
              href={e === "TODOS" ? base : `${base}?estado=${e}`}
              className={cn(
                "rounded-full px-3 py-1 text-xs transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "bg-accent text-muted-foreground hover:text-foreground",
              )}
            >
              {e === "TODOS" ? "Todos" : e}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin documentos"
          description={`No hay ${direction === "VENTA" ? "ventas" : "compras"} cargadas con este filtro. Importa desde Nubox en la pestaña Importar.`}
        />
      ) : (
        <DocumentsTable rows={rows} contactLabel={contactoLabel} />
      )}
      <UrlPagination page={page} pageSize={pageSize} total={total} />
    </>
  );
}
