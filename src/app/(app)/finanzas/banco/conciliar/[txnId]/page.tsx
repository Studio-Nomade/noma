import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { formatMoney } from "@/lib/currency/format";
import {
  getTransaction,
  getOpenDocumentsFor,
} from "@/features/finance/queries";
import { createReconciliation } from "@/features/finance/reconcile-actions";
import { formatDate, toNum } from "@/features/finance/helpers";

export default async function ConciliarPage({
  params,
}: {
  params: Promise<{ txnId: string }>;
}) {
  const { txnId } = await params;
  const txn = await getTransaction(txnId);
  if (!txn) notFound();

  const monto = toNum(txn.monto);
  // Un abono (entra plata) se concilia contra ventas; un cargo contra compras.
  const direction = txn.tipo === "ABONO" ? "VENTA" : "COMPRA";
  const docs = await getOpenDocumentsFor(direction);

  return (
    <>
      <Link
        href="/finanzas/banco"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Volver a banco
      </Link>

      <PageHeader
        title="Conciliar movimiento"
        description={`${formatDate(txn.fecha)} · ${txn.glosa}`}
      />

      <div className="border-border bg-card mb-6 flex items-center justify-between rounded-xl border p-5">
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            {txn.tipo === "ABONO" ? "Abono (por cobrar)" : "Cargo (por pagar)"}
          </p>
          <p className="font-heading mt-1 text-2xl font-semibold">
            {formatMoney(monto, "CLP")}
          </p>
        </div>
      </div>

      <h2 className="font-heading mb-3 text-base font-medium">
        Documentos abiertos ({direction === "VENTA" ? "ventas" : "compras"})
      </h2>

      {docs.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay documentos abiertos para conciliar. Importa las facturas
          correspondientes primero.
        </p>
      ) : (
        <form action={createReconciliation}>
          <input type="hidden" name="txnId" value={txn.id} />
          <div className="border-border bg-card overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border border-b text-left text-xs">
                  <th className="px-4 py-3"></th>
                  <th className="px-4 py-3">Folio</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Emisión</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-border/60 border-b">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        name="docIds"
                        value={d.id}
                        defaultChecked={Math.round(d.saldo) === Math.round(monto)}
                        className="size-4"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{d.folio}</td>
                    <td className="px-4 py-3">{d.contactName ?? "—"}</td>
                    <td className="px-4 py-3">{formatDate(d.fechaEmision)}</td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(d.saldo, "CLP")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium"
            >
              Conciliar seleccionados
            </button>
          </div>
        </form>
      )}
    </>
  );
}
