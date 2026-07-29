import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { formatMoney } from "@/lib/currency/format";
import {
  getBankAccounts,
  getOpenDocumentsFor,
  getTransactions,
} from "@/features/finance/queries";
import { createReconciliation } from "@/features/finance/reconcile-actions";
import { formatDate, toNum } from "@/features/finance/helpers";
import { cn } from "@/lib/utils";

export default async function BatchReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: "ABONO" | "CARGO" }>;
}) {
  const { tipo = "ABONO" } = await searchParams;
  const accounts = await getBankAccounts();
  const account = accounts[0];
  const transactions = account
    ? await getTransactions(
        account.id,
        { estado: "PENDIENTE" },
        { page: 1, pageSize: 200 },
      )
    : { rows: [], total: 0 };
  const txns = transactions.rows.filter((txn) => txn.tipo === tipo);
  const docs = await getOpenDocumentsFor(
    tipo === "ABONO" ? "VENTA" : "COMPRA",
  );
  return (
    <>
      <Link
        href="/finanzas/banco"
        className="text-muted-foreground hover:text-foreground mb-5 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Volver a banco
      </Link>
      <PageHeader
        title="Conciliación múltiple"
        description="Selecciona varios movimientos y varios documentos; Noma distribuye los saldos."
      />
      <div className="mb-5 flex gap-2">
        {(["ABONO", "CARGO"] as const).map((value) => (
          <Link
            key={value}
            href={`/finanzas/banco/conciliar-lote?tipo=${value}`}
            className={cn(
              "rounded-full px-3 py-1 text-xs",
              tipo === value
                ? "bg-foreground text-background"
                : "bg-accent text-muted-foreground",
            )}
          >
            {value === "ABONO" ? "Ingresos / ventas" : "Egresos / compras"}
          </Link>
        ))}
      </div>
      <form action={createReconciliation}>
        <div className="grid gap-6 lg:grid-cols-2">
          <SelectionTable
            title="Movimientos"
            name="txnIds"
            rows={txns.map((txn) => ({
              id: txn.id,
              primary: txn.glosa,
              secondary: formatDate(txn.fecha),
              amount: toNum(txn.monto) - toNum(txn.montoConciliado),
            }))}
          />
          <SelectionTable
            title="Documentos"
            name="docIds"
            rows={docs.map((doc) => ({
              id: doc.id,
              primary: `#${doc.folio} · ${doc.contactName || "—"}`,
              secondary: formatDate(doc.fechaEmision),
              amount: doc.saldo,
            }))}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium"
          >
            Conciliar selección N-a-N
          </button>
        </div>
      </form>
    </>
  );
}

function SelectionTable({
  title,
  name,
  rows,
}: {
  title: string;
  name: "txnIds" | "docIds";
  rows: {
    id: string;
    primary: string;
    secondary: string;
    amount: number;
  }[];
}) {
  return (
    <section className="glass rounded-xl p-4">
      <h2 className="font-heading mb-3 font-medium">{title}</h2>
      <div className="max-h-[520px] space-y-1 overflow-y-auto">
        {rows.map((row) => (
          <label
            key={row.id}
            className="hover:bg-accent/40 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm"
          >
            <input type="checkbox" name={name} value={row.id} className="size-4" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{row.primary}</span>
              <span className="text-muted-foreground text-xs">
                {row.secondary}
              </span>
            </span>
            <span className="font-medium">
              {formatMoney(row.amount, "CLP")}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
