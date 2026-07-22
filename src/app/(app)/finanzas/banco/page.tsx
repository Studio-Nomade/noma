import Link from "next/link";
import { Landmark, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/currency/format";
import { cn } from "@/lib/utils";
import {
  getBankAccounts,
  getTransactions,
  getSuggestions,
} from "@/features/finance/queries";
import {
  createReconciliation,
  ignoreTransaction,
} from "@/features/finance/reconcile-actions";
import { formatDate, toNum } from "@/features/finance/helpers";
import { UrlPagination } from "@/components/shared/url-pagination";

const ESTADOS = ["TODOS", "PENDIENTE", "CONCILIADO", "PARCIAL", "IGNORADO"];

export default async function BancoPage({
  searchParams,
}: {
  searchParams: Promise<{
    cuenta?: string;
    estado?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const {
    cuenta,
    estado,
    page: rawPage,
    pageSize: rawPageSize,
  } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const pageSize = [20, 50, 100, 200].includes(Number(rawPageSize))
    ? Number(rawPageSize)
    : 20;
  const accounts = await getBankAccounts();

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title="Banco" description="Movimientos y conciliación" />
        <EmptyState
          icon={Landmark}
          title="Sin cuentas bancarias"
          description="Ejecuta el seed para crear la cuenta BCI por defecto, o créala en Configuración."
        />
      </>
    );
  }

  const account = accounts.find((a) => a.id === cuenta) ?? accounts[0];
  const [transactions, suggestions] = await Promise.all([
    getTransactions(account.id, { estado }, { page, pageSize }),
    getSuggestions(account.id, 10),
  ]);
  const { rows: txns, total } = transactions;

  return (
    <>
      <PageHeader
        title="Banco"
        description="Movimientos bancarios y conciliación contra documentos"
      />

      {/* Selector de cuenta */}
      {accounts.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {accounts.map((a) => (
            <Link
              key={a.id}
              href={`/finanzas/banco?cuenta=${a.id}`}
              className={cn(
                "rounded-full px-3 py-1 text-xs",
                a.id === account.id
                  ? "bg-foreground text-background"
                  : "bg-accent text-muted-foreground hover:text-foreground",
              )}
            >
              {a.bank} · {a.name}
            </Link>
          ))}
        </div>
      )}

      <div className="glass mb-6 flex items-center justify-between rounded-xl p-5">
        <div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            {account.bank} · {account.name}
          </p>
          <p className="font-heading mt-1 text-2xl font-semibold">
            {formatMoney(account.saldo, "CLP")}
          </p>
        </div>
        <Landmark className="text-muted-foreground/50 size-8" />
      </div>

      {/* Sugerencias de conciliación */}
      {suggestions.length > 0 && (
        <div className="glass mb-6 rounded-xl p-5">
          <h2 className="font-heading mb-3 flex items-center gap-2 text-base font-medium">
            <Sparkles className="size-4" /> Sugerencias de conciliación
          </h2>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.txnId}
                className="border-border/60 flex items-center justify-between gap-4 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate">{s.glosa}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(s.fecha)} · doc #{s.docFolio} · {s.docContacto}
                  </span>
                </div>
                <span className="font-medium">
                  {formatMoney(s.monto, "CLP")}
                </span>
                <form action={createReconciliation}>
                  <input type="hidden" name="txnId" value={s.txnId} />
                  <input type="hidden" name="docIds" value={s.docId} />
                  <button
                    type="submit"
                    className="bg-foreground text-background rounded-md px-3 py-1 text-xs"
                  >
                    Conciliar
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-1">
        {ESTADOS.map((e) => {
          const active = (estado ?? "TODOS") === e;
          const qs = new URLSearchParams({ cuenta: account.id });
          if (e !== "TODOS") qs.set("estado", e);
          return (
            <Link
              key={e}
              href={`/finanzas/banco?${qs.toString()}`}
              className={cn(
                "rounded-full px-3 py-1 text-xs",
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

      {txns.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Sin movimientos"
          description="Importa una cartola BCI en la pestaña Importar."
        />
      ) : (
        <div className="glass-solid overflow-x-auto rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-xs">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Glosa</th>
                <th className="px-4 py-3 text-right">Cargo</th>
                <th className="px-4 py-3 text-right">Abono</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => {
                const monto = toNum(t.monto);
                return (
                  <tr key={t.id} className="border-border/60 border-b">
                    <td className="px-4 py-3">{formatDate(t.fecha)}</td>
                    <td className="px-4 py-3">
                      <span className="block max-w-[280px] truncate">
                        {t.glosa}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.tipo === "CARGO" ? formatMoney(monto, "CLP") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.tipo === "ABONO" ? formatMoney(monto, "CLP") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={t.status} />
                    </td>
                    <td className="px-4 py-3">
                      {t.status === "PENDIENTE" || t.status === "PARCIAL" ? (
                        <div className="flex justify-end gap-3">
                          <Link
                            href={`/finanzas/banco/conciliar/${t.id}`}
                            className="text-xs text-[var(--status-blue)] hover:underline"
                          >
                            Conciliar
                          </Link>
                          <form action={ignoreTransaction}>
                            <input type="hidden" name="id" value={t.id} />
                            <button
                              type="submit"
                              className="text-muted-foreground hover:text-foreground text-xs"
                            >
                              Ignorar
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <UrlPagination page={page} pageSize={pageSize} total={total} />
    </>
  );
}
