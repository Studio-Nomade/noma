import Link from "next/link";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/currency/format";
import { cn } from "@/lib/utils";
import type { DocumentDirection } from "@/types/enums";
import { getDocuments } from "./queries";
import { markDocumentPaid, anularDocument } from "./documents-actions";
import { formatDate, toNum } from "./helpers";

const ESTADOS = ["TODOS", "EMITIDA", "PARCIAL", "VENCIDA", "PAGADA", "CONCILIADA", "ANULADA"];

const TYPE_LABELS: Record<string, string> = {
  FACTURA_VENTA: "Factura",
  FACTURA_COMPRA: "Factura",
  NOTA_CREDITO: "N. Crédito",
  NOTA_DEBITO: "N. Débito",
  BOLETA: "Boleta",
  BOLETA_HONORARIOS: "B. Honorarios",
};

export async function DocumentsView({
  direction,
  estado,
}: {
  direction: DocumentDirection;
  estado?: string;
}) {
  const rows = await getDocuments(direction, { estado });
  const base = direction === "VENTA" ? "/finanzas/ingresos" : "/finanzas/egresos";
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
        <div className="border-border bg-card overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-xs">
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Folio</th>
                <th className="px-4 py-3">{contactoLabel}</th>
                <th className="px-4 py-3">Emisión</th>
                <th className="px-4 py-3">Vence</th>
                <th className="px-4 py-3 text-right">Neto</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const openable =
                  d.status === "EMITIDA" ||
                  d.status === "PARCIAL" ||
                  d.status === "VENCIDA";
                return (
                  <tr key={d.id} className="border-border/60 border-b">
                    <td className="px-4 py-3">
                      {TYPE_LABELS[d.type] ?? d.type}
                    </td>
                    <td className="px-4 py-3 font-medium">{d.folio}</td>
                    <td className="px-4 py-3">
                      <span className="block max-w-[200px] truncate">
                        {d.contactName ?? "—"}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {d.contactRut ?? ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatDate(d.fechaEmision)}</td>
                    <td className="px-4 py-3">
                      {formatDate(d.fechaVencimiento)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(toNum(d.neto), "CLP")}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(toNum(d.total), "CLP")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={d.status} />
                    </td>
                    <td className="px-4 py-3">
                      {openable && (
                        <div className="flex justify-end gap-3">
                          <form action={markDocumentPaid}>
                            <input type="hidden" name="id" value={d.id} />
                            <button
                              type="submit"
                              className="text-xs text-[var(--status-emerald)] hover:underline"
                            >
                              Marcar pagado
                            </button>
                          </form>
                          <form action={anularDocument}>
                            <input type="hidden" name="id" value={d.id} />
                            <button
                              type="submit"
                              className="text-muted-foreground hover:text-[var(--status-red)] text-xs"
                            >
                              Anular
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
