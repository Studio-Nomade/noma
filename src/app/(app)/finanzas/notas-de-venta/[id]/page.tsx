import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Download, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/currency/format";
import { formatDate } from "@/features/finance/helpers";
import {
  getSalesOrder,
  getSalesOrderBillingItems,
  getSalesOrderLines,
} from "@/features/finance/sales-orders/queries";
import { BillingPlanEditor } from "@/features/finance/sales-orders/billing-plan-editor";
import { SalesOrderSendForm } from "@/features/finance/sales-orders/send-form";

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [row, lines, billingItems] = await Promise.all([
    getSalesOrder(id),
    getSalesOrderLines(id),
    getSalesOrderBillingItems(id),
  ]);
  if (!row) notFound();
  const { order, client, projectName } = row;
  const billed = billingItems
    .filter((item) => item.status !== "PENDIENTE")
    .reduce((sum, item) => sum + Number(item.calculatedAmount), 0);
  const pending = Number(order.totalAmount) - billed;

  return (
    <>
      <Link
        href="/finanzas/notas-de-venta"
        className="text-muted-foreground hover:text-foreground mb-5 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Volver a notas de venta
      </Link>
      <PageHeader
        title={`${order.folio} · ${client.companyName}`}
        description={`${projectName} · ${formatDate(order.emissionDate)}`}
        action={
          <a
            href={`/finanzas/notas-de-venta/${id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="border-border inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <Download className="size-4" /> Ver PDF
          </a>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="glass rounded-xl p-5">
          <p className="text-muted-foreground text-xs">Estado</p>
          <div className="mt-2">
            <StatusBadge value={order.status} />
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <p className="text-muted-foreground text-xs">Total pactado</p>
          <p className="mt-1 text-xl font-semibold">
            {formatMoney(order.totalAmount, order.currency)}
          </p>
        </div>
        <div className="glass rounded-xl p-5">
          <p className="text-muted-foreground text-xs">Por cobrar</p>
          <p className="mt-1 text-xl font-semibold">
            {formatMoney(pending, order.currency)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="glass rounded-xl p-5">
            <h2 className="font-heading mb-4 text-lg font-medium">Documento</h2>
            <div className="border-border overflow-hidden rounded-lg border">
              <div className="bg-muted/40 grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 text-xs font-medium">
                <span>Servicio</span>
                <span>Cantidad</span>
                <span>Precio</span>
                <span>Total</span>
              </div>
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="border-border grid grid-cols-[1fr_auto_auto_auto] gap-3 border-t px-4 py-3 text-sm"
                >
                  <span>{line.description}</span>
                  <span>{line.quantity}</span>
                  <span>{formatMoney(line.priceAmount, line.currency)}</span>
                  <span>{formatMoney(line.totalAmount, line.currency)}</span>
                </div>
              ))}
            </div>
            <div className="ml-auto mt-4 max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatMoney(order.subtotalAmount, order.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA 19%</span>
                <span>{formatMoney(order.ivaAmount, order.currency)}</span>
              </div>
              <div className="border-border flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span>{formatMoney(order.totalAmount, order.currency)}</span>
              </div>
            </div>
          </section>

          <section className="glass rounded-xl p-5">
            <h2 className="font-heading mb-1 text-lg font-medium">
              Esquema de facturación
            </h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Define anticipos, hitos, entregables y fechas tentativas.
            </p>
            <BillingPlanEditor
              salesOrderId={id}
              initial={billingItems.map((item) => ({
                id: item.id,
                label: item.label,
                type: item.type,
                value: Number(item.value),
                tentativeDate: item.tentativeDate,
                deliverable: item.deliverable,
                status: item.status,
              }))}
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className="glass rounded-xl p-5">
            <h2 className="font-heading mb-4 text-lg font-medium">
              Estado del flujo
            </h2>
            <ol className="space-y-4 text-sm">
              {["Crear", "Enviar", "Facturar"].map((step, index) => {
                const done =
                  index === 0 ||
                  (index === 1 && order.status !== "BORRADOR") ||
                  (index === 2 &&
                    ["FACTURADA_PARCIAL", "FACTURADA"].includes(order.status));
                return (
                  <li key={step} className="flex items-center gap-3">
                    <span className="bg-muted flex size-7 items-center justify-center rounded-full">
                      {done ? <Check className="size-4" /> : index + 1}
                    </span>
                    {step}
                  </li>
                );
              })}
            </ol>
          </section>
          <section className="glass rounded-xl p-5">
            <h2 className="font-heading mb-4 flex items-center gap-2 text-lg font-medium">
              <ReceiptText className="size-5" /> Enviar al cliente
            </h2>
            <SalesOrderSendForm
              salesOrderId={id}
              folio={order.folio}
              clientName={client.contactName || client.companyName}
              defaultEmail={client.billingEmail || client.email || ""}
            />
          </section>
        </div>
      </div>
    </>
  );
}
