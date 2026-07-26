import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CircleDollarSign,
  Landmark,
  Tags,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { formatMoney } from "@/lib/currency/format";
import { getDashboardKpis } from "@/features/finance/queries";
import { getMonthlyCloseCockpit } from "@/features/finance/monthly-close";
import { FlujoBars } from "@/features/finance/flujo-bars";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { cn } from "@/lib/utils";

function recentMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1),
    );
    return date.toISOString().slice(0, 7);
  });
}

export default async function FinanceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const months = recentMonths();
  const selectedMonth = /^\d{4}-\d{2}$/.test(params.mes ?? "")
    ? params.mes!
    : months.at(-1)!;
  const allMonths = months.includes(selectedMonth)
    ? months
    : [...months.slice(1), selectedMonth].sort();
  const [kpis, ...monthly] = await Promise.all([
    getDashboardKpis(),
    ...allMonths.map(getMonthlyCloseCockpit),
  ]);
  const close = monthly.find((item) => item.period === selectedMonth)!;
  const role = roleFor(user.email);
  const name =
    String(user.user_metadata?.full_name ?? "").split(" ")[0] ||
    user.email?.split("@")[0] ||
    "equipo";
  const roleLabel =
    role.tier === "superadmin"
      ? "Administración"
      : role.tier === "comercialFinanciero"
        ? "Comercial y Finanzas"
        : "Finanzas";
  const selectedFlow = kpis.flujo.find(
    (item) => item.periodo === selectedMonth,
  );

  return (
    <>
      <PageHeader
        title={`Hola, ${name}`}
        description={`${roleLabel} · cierre financiero de ${selectedMonth}`}
      />

      <section className="glass mb-6 rounded-xl p-5">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs">Avance del mes</p>
            <p className="font-heading text-3xl font-semibold">
              {close.progress}%
            </p>
            <p className="text-muted-foreground text-xs">
              {close.completedTasks} de {close.totalTasks} tareas completadas
            </p>
          </div>
          <div className="bg-accent h-2 min-w-52 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-foreground h-full rounded-full transition-[width]"
              style={{ width: `${close.progress}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {monthly.map((month) => (
            <Link
              key={month.period}
              href={`/finanzas?mes=${month.period}`}
              className={cn(
                "rounded-lg border p-2",
                month.period === selectedMonth
                  ? "border-foreground bg-accent"
                  : "border-border",
              )}
            >
              <span className="text-muted-foreground block text-xs">
                {month.period}
              </span>
              <span className="mt-2 block text-sm font-medium">
                {month.progress}%
              </span>
              <span className="bg-accent mt-1 block h-1 overflow-hidden rounded-full">
                <span
                  className="bg-foreground block h-full"
                  style={{ width: `${month.progress}%` }}
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-2">
        <CloseTaskCard
          icon={Landmark}
          title="Movimientos bancarios"
          count={`${close.movement.pendingCredits} abonos · ${close.movement.pendingDebits} cargos pendientes`}
          amount={close.movement.pendingAmount}
          detail={`${close.movement.reconciled} conciliados · ${close.movement.automatic} automáticos`}
          href={`/finanzas/banco?mes=${selectedMonth}&estado=PENDIENTE`}
        />
        <CloseTaskCard
          icon={CircleDollarSign}
          title="Cuentas por cobrar"
          count={`${close.accountsReceivable.invoices} facturas · ${close.accountsReceivable.salesOrders} cuotas de NV`}
          amount={close.accountsReceivable.amount}
          detail={`${close.accountsReceivable.completed} cobros cerrados`}
          href={`/finanzas/ingresos?periodo=${selectedMonth}`}
        />
        <CloseTaskCard
          icon={Banknote}
          title="Cuentas por pagar"
          count={`${close.accountsPayable.invoices} facturas pendientes`}
          amount={close.accountsPayable.amount}
          detail={`${close.accountsPayable.completed} pagos cerrados`}
          href={`/finanzas/egresos?periodo=${selectedMonth}`}
        />
        <CloseTaskCard
          icon={Tags}
          title="Resultado Operacional"
          count={`${close.classification.pending} documentos por clasificar`}
          amount={close.classification.pendingAmount}
          detail={`${close.classification.classified} clasificados · ${close.classification.automatic} automáticos`}
          href="/finanzas/plan-cuentas/sin-clasificar"
        />
      </section>

      <details className="glass rounded-xl">
        <summary className="cursor-pointer px-5 py-4 font-medium">
          Resumen financiero y flujo de caja
        </summary>
        <div className="border-border border-t p-5">
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
              value={formatMoney(selectedFlow?.neto ?? 0, "CLP")}
              subtext={`Flujo neto ${selectedMonth}`}
            />
          </div>
          <h2 className="font-heading mb-1 text-base font-medium">
            Flujo de caja real (12 meses)
          </h2>
          <FlujoBars data={kpis.flujo} />
        </div>
      </details>
    </>
  );
}

function CloseTaskCard({
  icon: Icon,
  title,
  count,
  amount,
  detail,
  href,
}: {
  icon: typeof Landmark;
  title: string;
  count: string;
  amount: number;
  detail: string;
  href: string;
}) {
  return (
    <article className="glass rounded-xl p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="bg-accent rounded-lg p-2">
          <Icon className="size-5" />
        </span>
        <Link
          href={href}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          Revisar <ArrowRight className="size-4" />
        </Link>
      </div>
      <h2 className="font-heading font-medium">{title}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{count}</p>
      <p className="mt-3 text-xl font-semibold">
        {formatMoney(amount, "CLP")}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
    </article>
  );
}
