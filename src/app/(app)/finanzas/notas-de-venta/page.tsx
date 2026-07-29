import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/currency/format";
import { formatDate } from "@/features/finance/helpers";
import { listSalesOrders } from "@/features/finance/sales-orders/queries";

export default async function SalesOrdersPage() {
  const rows = await listSalesOrders();
  return (
    <>
      <PageHeader
        title="Notas de venta"
        description="Condiciones aceptadas y esquemas de facturación"
      />
      <div className="glass overflow-hidden rounded-xl">
        {rows.length === 0 ? (
          <div className="text-muted-foreground p-10 text-center text-sm">
            Las notas de venta se generan desde una propuesta aprobada.
          </div>
        ) : (
          <div className="divide-border divide-y">
            {rows.map(({ order, clientName, projectName }) => (
              <Link
                key={order.id}
                href={`/finanzas/notas-de-venta/${order.id}`}
                className="hover:bg-accent/40 grid gap-3 p-4 transition-colors md:grid-cols-[auto_1fr_auto_auto] md:items-center"
              >
                <FileText className="text-muted-foreground size-5" />
                <div>
                  <p className="font-medium">
                    {order.folio} · {clientName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {projectName} · emitida {formatDate(order.emissionDate)}
                  </p>
                </div>
                <StatusBadge value={order.status} />
                <div className="text-right">
                  <p className="font-medium">
                    {formatMoney(order.totalAmount, order.currency)}
                  </p>
                  <p className="text-muted-foreground text-xs">Total pactado</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
