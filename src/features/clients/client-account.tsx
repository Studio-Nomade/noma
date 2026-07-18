"use client";

import { useMemo, useState } from "react";
import { FileText, FileCode2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/currency/format";
import type { ClientAccount } from "./invoices-queries";

/** Etiqueta de estado según saldo y vencimiento (lenguaje del estado de cuenta). */
function estadoDe(inv: ClientAccount["invoices"][number]) {
  if (inv.saldo === 0) return { texto: "Pagada", tono: "emerald" as const };
  if (inv.diasVencida === null) return { texto: "Emitida", tono: "slate" as const };
  if (inv.diasVencida > 0)
    return { texto: `Vencida hace ${inv.diasVencida} d`, tono: "red" as const };
  return { texto: `Vence en ${Math.abs(inv.diasVencida)} d`, tono: "slate" as const };
}

const fecha = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString("es-CL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border rounded-xl border p-4">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function ClientAccountCard({ account }: { account: ClientAccount }) {
  const [tab, setTab] = useState<"pendientes" | "todas">("pendientes");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const base =
      tab === "pendientes"
        ? account.invoices.filter((i) => i.saldo > 0)
        : account.invoices;
    const query = q.trim().toLowerCase();
    if (!query) return base;
    return base.filter((i) => (i.folio ?? "").toLowerCase().includes(query));
  }, [account.invoices, tab, q]);

  if (account.invoices.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
        Sin facturas registradas para este cliente.
        <p className="mt-1 text-xs">
          Las facturas se cruzan por RUT desde el módulo de Finanzas al importar
          los documentos del SII.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Total pendiente">
          <p className="text-xl font-semibold">
            {formatMoney(String(account.totalPendiente), "CLP")}
          </p>
          {account.vencidas > 0 && (
            <p className="mt-0.5 text-xs text-[var(--status-red)]">
              {account.vencidas}{" "}
              {account.vencidas === 1 ? "factura vencida" : "facturas vencidas"}
            </p>
          )}
        </Kpi>
        <Kpi label="Facturación histórica">
          <p className="text-xl font-semibold">
            {formatMoney(String(account.totalFacturado), "CLP")}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {account.invoices.length}{" "}
            {account.invoices.length === 1 ? "factura" : "facturas"}
          </p>
        </Kpi>
        <Kpi label="Días de pago promedio">
          <p className="text-xl font-semibold">
            {account.diasPagoPromedio !== null
              ? `${account.diasPagoPromedio} d`
              : "—"}
          </p>
          {account.diasPagoPromedio === null && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              Aún sin facturas pagadas
            </p>
          )}
        </Kpi>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="border-border bg-card inline-flex rounded-lg border p-0.5">
          {(["pendientes", "todas"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                tab === t
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "pendientes" ? "Por pagar" : "Todas"}
            </button>
          ))}
        </div>
        <div className="relative max-w-[14rem] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar folio…"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-muted-foreground text-left text-xs">
              <th className="px-3 py-2 font-medium">Folio</th>
              <th className="px-3 py-2 font-medium">Emisión</th>
              <th className="px-3 py-2 text-right font-medium">Monto total</th>
              <th className="px-3 py-2 text-right font-medium">Saldo</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 text-right font-medium">Archivos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => {
              const e = estadoDe(inv);
              return (
                <tr key={inv.id} className="border-border border-t">
                  <td className="px-3 py-2 font-medium">{inv.folio ?? "—"}</td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {fecha(inv.fechaEmision)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatMoney(inv.total, "CLP")}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatMoney(String(inv.saldo), "CLP")}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                      style={{
                        color: `var(--status-${e.tono})`,
                        background: `var(--status-${e.tono}-bg)`,
                      }}
                    >
                      {e.texto}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {/* Descarga real cuando el archivo existe (enlace firmado);
                        inactivo si Finanzas aún no lo cargó. */}
                    <div className="flex items-center justify-end gap-1">
                      {[
                        { Icon: FileCode2, label: "XML", url: inv.xmlUrl },
                        { Icon: FileText, label: "PDF", url: inv.pdfUrl },
                      ].map(({ Icon, label, url }) =>
                        url ? (
                          <a
                            key={label}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors hover:bg-accent"
                          >
                            <Icon className="size-3" />
                            {label}
                          </a>
                        ) : (
                          <button
                            key={label}
                            disabled
                            title="El estudio aún no ha cargado este archivo"
                            className="text-muted-foreground/40 inline-flex cursor-not-allowed items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-medium"
                          >
                            <Icon className="size-3" />
                            {label}
                          </button>
                        ),
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr className="border-border border-t">
                <td
                  colSpan={6}
                  className="text-muted-foreground py-6 text-center text-xs"
                >
                  {q
                    ? `Sin resultados para “${q}”.`
                    : "Sin facturas por pagar. 🎉"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
