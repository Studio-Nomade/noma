import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { formatMoney } from "@/lib/currency/format";
import {
  getResultadoOperacional,
  getFlujoCajaReal,
  getFlujoCajaProyectado,
  getPorContacto,
  getResultadoPorLinea,
} from "@/features/finance/queries";
import { FlujoBars } from "@/features/finance/flujo-bars";

const TYPE_LABELS: Record<string, string> = {
  INGRESO: "Ingreso",
  COSTO: "Costo",
  GASTO: "Gasto",
  ACTIVO: "Activo",
  PASIVO: "Pasivo",
  PATRIMONIO: "Patrimonio",
  SIN: "—",
};

export default async function ReportesPage() {
  const [resultado, flujoReal, proyectado, porCliente, porProveedor, porLinea] =
    await Promise.all([
      getResultadoOperacional(),
      getFlujoCajaReal(12),
      getFlujoCajaProyectado(),
      getPorContacto("VENTA", 10),
      getPorContacto("COMPRA", 10),
      getResultadoPorLinea(),
    ]);

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Resultado operacional, flujo de caja y análisis por contacto y línea"
        action={
          <Link
            href="/finanzas/reportes/export"
            className="border-border inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <Download className="size-4" /> Exportar XLSX
          </Link>
        }
      />

      {/* Resultado operacional */}
      <section className="mb-8">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            label="Ingresos (neto)"
            value={formatMoney(resultado.ingresos, "CLP")}
          />
          <MetricCard
            label="Egresos (neto)"
            value={formatMoney(resultado.egresos, "CLP")}
          />
          <MetricCard
            label="Resultado"
            value={formatMoney(resultado.resultado, "CLP")}
          />
        </div>
        <div className="glass-solid overflow-x-auto rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-xs">
                <th className="px-4 py-3">Cuenta</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Neto</th>
              </tr>
            </thead>
            <tbody>
              {resultado.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="text-muted-foreground px-4 py-6 text-center"
                  >
                    Sin documentos clasificados todavía.
                  </td>
                </tr>
              ) : (
                resultado.rows.map((r) => (
                  <tr key={r.code} className="border-border/60 border-b">
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground mr-2 tabular-nums">
                        {r.code}
                      </span>
                      {r.name}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {TYPE_LABELS[r.type] ?? r.type}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(r.neto, "CLP")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Flujo de caja */}
      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass rounded-xl p-5">
          <h2 className="font-heading mb-3 text-base font-medium">
            Flujo de caja real (12 meses)
          </h2>
          <FlujoBars data={flujoReal} />
        </div>
        <div className="glass rounded-xl p-5">
          <h2 className="font-heading mb-3 text-base font-medium">
            Flujo proyectado (por vencimiento)
          </h2>
          {proyectado.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Sin documentos con vencimiento pendiente.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border border-b text-left text-xs">
                  <th className="py-2">Período</th>
                  <th className="py-2 text-right">Cobrar</th>
                  <th className="py-2 text-right">Pagar</th>
                  <th className="py-2 text-right">Neto</th>
                </tr>
              </thead>
              <tbody>
                {proyectado.map((p) => (
                  <tr key={p.periodo} className="border-border/60 border-b">
                    <td className="py-2">{p.periodo}</td>
                    <td className="py-2 text-right">
                      {formatMoney(p.porCobrar, "CLP")}
                    </td>
                    <td className="py-2 text-right">
                      {formatMoney(p.porPagar, "CLP")}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatMoney(p.neto, "CLP")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Por contacto */}
      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ContactoTable title="Ingresos por cliente" rows={porCliente} />
        <ContactoTable title="Egresos por proveedor" rows={porProveedor} />
      </section>

      {/* Por línea de negocio */}
      <section>
        <div className="glass-solid overflow-x-auto rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-xs">
                <th className="px-4 py-3">Línea de negocio</th>
                <th className="px-4 py-3 text-right">Ventas</th>
                <th className="px-4 py-3 text-right">Compras</th>
                <th className="px-4 py-3 text-right">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {porLinea.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-muted-foreground px-4 py-6 text-center"
                  >
                    Sin documentos asignados a líneas de negocio.
                  </td>
                </tr>
              ) : (
                porLinea.map((l) => (
                  <tr key={l.linea} className="border-border/60 border-b">
                    <td className="px-4 py-3">{l.linea}</td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(l.ventas, "CLP")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(l.compras, "CLP")}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(l.resultado, "CLP")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ContactoTable({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; rut: string; neto: number; docs: number }[];
}) {
  return (
    <div className="glass rounded-xl p-5">
      <h2 className="font-heading mb-3 text-base font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-4 text-sm">Sin datos.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-border/60 border-b">
                <td className="py-2">
                  <span className="block max-w-[220px] truncate">{r.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {r.docs} doc(s)
                  </span>
                </td>
                <td className="py-2 text-right font-medium">
                  {formatMoney(r.neto, "CLP")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
