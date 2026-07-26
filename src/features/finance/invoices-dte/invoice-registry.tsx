import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/currency/format";
import { formatDate } from "@/features/finance/helpers";
import type { InvoiceStatus } from "@/types/enums";
import { listInvoiceRegistry } from "./queries";

function agingLabel(value: string | null) {
  if (!value) return "Sin fecha estimada";
  const target = new Date(`${value}T12:00:00`).getTime();
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = Math.round((target - today.getTime()) / 86_400_000);
  if (days === 0) return "Vence hoy";
  if (days > 0) return `en ${days} día${days === 1 ? "" : "s"}`;
  const elapsed = Math.abs(days);
  return `hace ${elapsed} día${elapsed === 1 ? "" : "s"}`;
}

export async function InvoiceRegistry({
  status,
  unassigned,
}: {
  status?: InvoiceStatus;
  unassigned?: boolean;
}) {
  const rows = await listInvoiceRegistry({ status, unassigned });
  if (!rows.length) {
    return (
      <div className="glass text-muted-foreground rounded-xl p-10 text-center text-sm">
        No hay facturas en esta vista.
      </div>
    );
  }
  return (
    <div className="glass overflow-hidden rounded-xl">
      <div className="divide-border divide-y">
        {rows.map(
          ({
            invoice,
            clientName,
            projectName,
            salesOrderFolio,
            billingLabel,
          }) => {
            const paymentDate =
              invoice.estimatedPaymentDate ?? invoice.dueAt;
            return (
              <Link
                key={invoice.id}
                href={`/finanzas/ingresos/${invoice.id}`}
                className="hover:bg-accent/40 grid gap-3 p-4 transition-colors lg:grid-cols-[1.5fr_1fr_auto_auto_auto] lg:items-center"
              >
                <div>
                  <p className="font-medium">
                    {invoice.folio || "Sin folio"} · {clientName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {projectName || "Sin proyecto"}
                    {salesOrderFolio
                      ? ` · ${salesOrderFolio} / ${billingLabel}`
                      : " · Sin Nota de Venta"}
                  </p>
                </div>
                <div className="text-sm">
                  <p>{formatDate(invoice.issuedAt)}</p>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Clock className="size-3" />
                    Pago est. {formatDate(paymentDate)} ·{" "}
                    {agingLabel(paymentDate)}
                  </p>
                </div>
                <StatusBadge value={invoice.status} />
                <p className="text-right font-medium">
                  {formatMoney(invoice.balanceDue, invoice.currency ?? "CLP")}
                </p>
                <ArrowUpRight className="text-muted-foreground size-4" />
              </Link>
            );
          },
        )}
      </div>
    </div>
  );
}
