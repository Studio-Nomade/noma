import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency/format";
import { formatDate } from "@/features/finance/helpers";
import {
  getInvoiceDte,
  listAssignableBillingItems,
} from "@/features/finance/invoices-dte/queries";
import {
  assignInvoiceToBillingItem,
  updateInvoiceCollectionStatus,
} from "@/features/finance/invoices-dte/actions";
import { DteUploadForm } from "@/features/finance/invoices-dte/dte-upload-form";

export default async function InvoiceDtePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [row, assignable] = await Promise.all([
    getInvoiceDte(id),
    listAssignableBillingItems(),
  ]);
  if (!row) notFound();
  const { invoice } = row;
  return (
    <>
      <Link
        href="/finanzas/ingresos"
        className="text-muted-foreground hover:text-foreground mb-5 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Volver a ingresos
      </Link>
      <PageHeader
        title={`Factura ${invoice.folio || "sin folio"} · ${row.clientName}`}
        description={`${row.projectName || "Sin proyecto"} · ${formatDate(invoice.issuedAt)}`}
        action={<StatusBadge value={invoice.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-xl p-5 lg:col-span-2">
          <h2 className="font-heading mb-4 text-lg font-medium">
            Registro tributario
          </h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Row label="Nota de Venta" value={row.salesOrderFolio || "Sin asignar"} />
            <Row label="Hito" value={row.billingLabel || "—"} />
            <Row label="Fecha emisión" value={formatDate(invoice.issuedAt)} />
            <Row
              label="Pago estimado"
              value={formatDate(
                invoice.estimatedPaymentDate ?? invoice.dueAt,
              )}
            />
            <Row
              label="Neto"
              value={formatMoney(invoice.netAmount, invoice.currency ?? "CLP")}
            />
            <Row
              label="IVA"
              value={formatMoney(invoice.ivaAmount, invoice.currency ?? "CLP")}
            />
            <Row
              label="Total"
              value={formatMoney(invoice.totalAmount, invoice.currency ?? "CLP")}
            />
            <Row
              label="Saldo"
              value={formatMoney(invoice.balanceDue, invoice.currency ?? "CLP")}
            />
          </dl>
          {!invoice.salesOrderId && (
            <form
              action={assignInvoiceToBillingItem}
              className="border-border mt-6 flex flex-wrap items-end gap-3 border-t pt-5"
            >
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <label className="min-w-72 flex-1 text-sm">
                <span className="mb-1.5 block font-medium">
                  Asociar a Nota de Venta / hito
                </span>
                <select
                  name="billingItemId"
                  required
                  className="border-input bg-background h-9 w-full rounded-md border px-3"
                >
                  <option value="">Selecciona…</option>
                  {assignable.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.folio} · {item.clientName} · {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit">Asignar NV</Button>
            </form>
          )}
          <form
            action={updateInvoiceCollectionStatus}
            className="border-border mt-6 flex flex-wrap gap-2 border-t pt-5"
          >
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <Button type="submit" name="status" value="Por cobrar" variant="outline">
              Por cobrar
            </Button>
            <Button type="submit" name="status" value="Reclamada" variant="outline">
              Marcar reclamada
            </Button>
            <Button type="submit" name="status" value="Pagada">
              Asignar pago
            </Button>
          </form>
        </div>
        <div className="space-y-6">
          <section className="glass rounded-xl p-5">
            <h2 className="font-heading mb-4 text-lg font-medium">
              Archivos DTE
            </h2>
            <div className="mb-4 flex flex-wrap gap-2">
              {row.pdf && (
                <a
                  href={row.pdf}
                  target="_blank"
                  rel="noreferrer"
                  className="border-border inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm"
                >
                  PDF <ExternalLink className="size-3" />
                </a>
              )}
              {row.xml && (
                <a
                  href={row.xml}
                  target="_blank"
                  rel="noreferrer"
                  className="border-border inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm"
                >
                  XML <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            <DteUploadForm invoiceId={invoice.id} />
          </section>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
