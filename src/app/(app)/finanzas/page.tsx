import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { formatMoney } from "@/lib/currency/format";
import {
  getDashboardKpis,
  getFlujoCajaProyectado,
} from "@/features/finance/queries";
import { FlujoBars } from "@/features/finance/flujo-bars";

export default async function FinanceDashboardPage() {
  const [kpis, proyectado] = await Promise.all([
    getDashboardKpis(),
    getFlujoCajaProyectado(),
  ]);

  const mesActual = new Date().toISOString().slice(0, 7);

  return (
    <>
      <PageHeader
        title="Dashboard financiero"
        description="Control de caja, cobros y pagos de Studio Nomade"
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Por cobrar"
          value={formatMoney(kpis.porCobrar, "CLP")}
          subtext="Facturas de venta abiertas"
        />
        <MetricCard
          label="Por pagar"
          value={formatMoney(kpis.porPagar, "CLP")}
          subtext="Facturas de compra abiertas"
        />
        <MetricCard
          label="Saldo en banco"
          value={formatMoney(kpis.saldoBanco, "CLP")}
          subtext="Suma de cuentas"
        />
        <MetricCard
          label="Resultado del mes"
          value={formatMoney(kpis.resultadoMes, "CLP")}
          subtext={`Flujo neto ${mesActual}`}
        />
      </div>

      <div className="glass mb-8 rounded-xl p-5">
        <h2 className="font-heading mb-1 text-base font-medium">
          Flujo de caja real (12 meses)
        </h2>
        <p className="text-muted-foreground mb-4 text-xs">
          Ingresos (verde) y egresos (rojo) por mes, desde movimientos
          bancarios.
        </p>
        <FlujoBars data={kpis.flujo} />
      </div>

      <div className="glass rounded-xl p-5">
        <h2 className="font-heading mb-1 text-base font-medium">
          Flujo proyectado (por vencimiento)
        </h2>
        <p className="text-muted-foreground mb-4 text-xs">
          Cobros y pagos esperados según el vencimiento de documentos abiertos.
        </p>
        {proyectado.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No hay documentos con vencimiento pendiente.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border border-b text-left text-xs">
                  <th className="py-2 pr-4">Período</th>
                  <th className="py-2 pr-4 text-right">Por cobrar</th>
                  <th className="py-2 pr-4 text-right">Por pagar</th>
                  <th className="py-2 text-right">Neto</th>
                </tr>
              </thead>
              <tbody>
                {proyectado.map((p) => (
                  <tr key={p.periodo} className="border-border/60 border-b">
                    <td className="py-2 pr-4">{p.periodo}</td>
                    <td className="py-2 pr-4 text-right">
                      {formatMoney(p.porCobrar, "CLP")}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {formatMoney(p.porPagar, "CLP")}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatMoney(p.neto, "CLP")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
