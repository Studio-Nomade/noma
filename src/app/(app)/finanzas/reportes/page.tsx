import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { formatMoney } from "@/lib/currency/format";
import {
  getFlujoCajaProyectado,
  getFlujoCajaReal,
  getPorContacto,
  getResultadoPorLinea,
} from "@/features/finance/queries";
import {
  getMonthlyProfitAndLoss,
  type ProfitLossGrouping,
  type ProfitLossReport,
  type ProfitLossRow,
  type ProfitLossSection,
} from "@/features/finance/profit-loss";
import { FlujoBars } from "@/features/finance/flujo-bars";
import { cn } from "@/lib/utils";

const GROUPS: { value: ProfitLossGrouping; label: string }[] = [
  { value: "account", label: "Por Cuenta / Producto" },
  { value: "client", label: "Por Cliente" },
  { value: "line", label: "Por Línea de Negocio" },
];
const SECTION_LABELS: Record<ProfitLossSection, string> = {
  income: "Ingresos por Servicios del Giro",
  cost: "Costos Directos",
  expense: "Gastos",
  unclassified: "Otros egresos sin clasificar",
};

function defaultRange() {
  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1));
  return {
    from: start.toISOString().slice(0, 7),
    to: end.toISOString().slice(0, 7),
  };
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    agrupar?: ProfitLossGrouping;
    porFacturar?: string;
  }>;
}) {
  const params = await searchParams;
  const defaults = defaultRange();
  const from = /^\d{4}-\d{2}$/.test(params.desde ?? "")
    ? params.desde!
    : defaults.from;
  const to = /^\d{4}-\d{2}$/.test(params.hasta ?? "")
    ? params.hasta!
    : defaults.to;
  const grouping = GROUPS.some((item) => item.value === params.agrupar)
    ? params.agrupar!
    : "account";
  const includeUnbilled = params.porFacturar === "1";
  const [pnl, flujoReal, proyectado, porCliente, porProveedor, porLinea] =
    await Promise.all([
      getMonthlyProfitAndLoss({ from, to, grouping, includeUnbilled }),
      getFlujoCajaReal(12),
      getFlujoCajaProyectado(),
      getPorContacto("VENTA", 10),
      getPorContacto("COMPRA", 10),
      getResultadoPorLinea(),
    ]);
  const query = new URLSearchParams({
    desde: from,
    hasta: to,
    agrupar: grouping,
    ...(includeUnbilled ? { porFacturar: "1" } : {}),
  });
  const visibleProjection = proyectado
    .filter((row) => row.periodo >= from)
    .slice(0, 24);

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Estado de Resultados mensual, flujo de caja y análisis financiero"
        action={
          <Link
            href={`/finanzas/reportes/export?${query}`}
            className="border-border inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <Download className="size-4" /> Exportar XLSX
          </Link>
        }
      />

      <form className="glass mb-5 grid gap-4 rounded-xl p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="text-sm">
          <span className="text-muted-foreground mb-1 block text-xs">Desde</span>
          <input
            type="month"
            name="desde"
            defaultValue={from}
            className="border-border bg-background w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground mb-1 block text-xs">Hasta</span>
          <input
            type="month"
            name="hasta"
            defaultValue={to}
            className="border-border bg-background w-full rounded-md border px-3 py-2"
          />
        </label>
        <button className="bg-foreground text-background rounded-md px-4 py-2 text-sm font-medium">
          Aplicar rango
        </button>
        <input type="hidden" name="agrupar" value={grouping} />
        <label className="flex items-center gap-2 text-sm md:col-span-3">
          <input
            type="checkbox"
            name="porFacturar"
            value="1"
            defaultChecked={includeUnbilled}
            className="size-4"
          />
          Ver ingresos por facturar en la proforma
        </label>
      </form>

      <nav className="mb-4 flex flex-wrap gap-2">
        {GROUPS.map((group) => {
          const groupQuery = new URLSearchParams(query);
          groupQuery.set("agrupar", group.value);
          return (
            <Link
              key={group.value}
              href={`/finanzas/reportes?${groupQuery}`}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm",
                grouping === group.value
                  ? "bg-foreground text-background"
                  : "bg-accent text-muted-foreground",
              )}
            >
              {group.label}
            </Link>
          );
        })}
      </nav>

      <ProfitLossTable report={pnl} />

      <section className="my-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass rounded-xl p-5">
          <h2 className="font-heading mb-3 text-base font-medium">
            Flujo de caja real (12 meses)
          </h2>
          <FlujoBars data={flujoReal} />
        </div>
        <div className="glass overflow-x-auto rounded-xl p-5">
          <h2 className="font-heading mb-3 text-base font-medium">
            Flujo proyectado (documentos + Notas de Venta)
          </h2>
          {visibleProjection.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Sin vencimientos ni cuotas de Notas de Venta pendientes.
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
                {visibleProjection.map((row) => (
                  <tr key={row.periodo} className="border-border/60 border-b">
                    <td className="py-2">{row.periodo}</td>
                    <MoneyCell value={row.porCobrar} />
                    <MoneyCell value={row.porPagar} />
                    <MoneyCell value={row.neto} strong />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ContactTable title="Ingresos por cliente" rows={porCliente} />
        <ContactTable title="Egresos por proveedor" rows={porProveedor} />
        <div className="glass rounded-xl p-5">
          <h2 className="font-heading mb-3 text-base font-medium">
            Resultado por línea
          </h2>
          {porLinea.map((row) => (
            <div
              key={row.linea}
              className="border-border/60 flex justify-between gap-3 border-b py-2 text-sm"
            >
              <span>{row.linea}</span>
              <span className="font-medium">
                {formatMoney(row.resultado, "CLP")}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function ProfitLossTable({ report }: { report: ProfitLossReport }) {
  const sections: ProfitLossSection[] = [
    "income",
    "cost",
    "expense",
    "unclassified",
  ];
  return (
    <div className="glass-solid overflow-x-auto rounded-xl">
      <table className="min-w-[980px] w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-border border-b text-xs">
            <th className="sticky left-0 bg-background px-4 py-3 text-left">
              Estado de Resultados
            </th>
            {report.months.map((month) => (
              <th key={month} className="px-3 py-3 text-right">
                {month}
              </th>
            ))}
            <th className="px-3 py-3 text-right">Total</th>
            <th className="px-3 py-3 text-right">
              Proforma {report.currentMonth}
            </th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => {
            const rows = report.rows.filter((row) => row.section === section);
            return (
              <SectionRows
                key={section}
                label={SECTION_LABELS[section]}
                rows={rows}
                months={report.months}
                total={report.totals[section]}
              />
            );
          })}
          <TotalRow
            label="Margen Bruto"
            values={report.totals.grossMargin}
            months={report.months}
            income={report.totals.income}
            showPercent
          />
          <TotalRow
            label="Resultado Operacional"
            values={report.totals.operatingResult}
            months={report.months}
            income={report.totals.income}
            showPercent
            prominent
          />
        </tbody>
      </table>
    </div>
  );
}

function SectionRows({
  label,
  rows,
  months,
  total,
}: {
  label: string;
  rows: ProfitLossRow[];
  months: string[];
  total: ProfitLossReport["totals"]["income"];
}) {
  return (
    <>
      <TotalRow label={label} values={total} months={months} />
      {rows.map((row) => (
        <tr key={row.key} className="border-border/50 border-b">
          <td className="sticky left-0 bg-background px-4 py-2 pl-8">
            <span className="block">{row.label}</span>
            {row.detail && (
              <span className="text-muted-foreground block text-xs">
                {row.detail}
              </span>
            )}
          </td>
          {months.map((month) => (
            <MoneyCell key={month} value={row.months[month]} />
          ))}
          <MoneyCell value={row.total} />
          <MoneyCell value={row.proforma} />
        </tr>
      ))}
    </>
  );
}

function TotalRow({
  label,
  values,
  months,
  income,
  showPercent,
  prominent,
}: {
  label: string;
  values: ProfitLossReport["totals"]["income"];
  months: string[];
  income?: ProfitLossReport["totals"]["income"];
  showPercent?: boolean;
  prominent?: boolean;
}) {
  const percent = (value: number, base: number) =>
    base ? ` · ${((value / base) * 100).toFixed(1)}%` : "";
  return (
    <tr
      className={cn(
        "border-border border-b font-medium",
        prominent && "bg-accent/50 text-base",
      )}
    >
      <td className="sticky left-0 bg-inherit px-4 py-3">{label}</td>
      {months.map((month) => (
        <td key={month} className="px-3 py-3 text-right tabular-nums">
          {formatMoney(values.months[month], "CLP")}
          {showPercent && income && (
            <span className="text-muted-foreground block text-[10px]">
              {percent(values.months[month], income.months[month])}
            </span>
          )}
        </td>
      ))}
      <td className="px-3 py-3 text-right tabular-nums">
        {formatMoney(values.total, "CLP")}
        {showPercent && income && (
          <span className="text-muted-foreground block text-[10px]">
            {percent(values.total, income.total)}
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        {formatMoney(values.proforma, "CLP")}
        {showPercent && income && (
          <span className="text-muted-foreground block text-[10px]">
            {percent(values.proforma, income.proforma)}
          </span>
        )}
      </td>
    </tr>
  );
}

function MoneyCell({
  value,
  strong,
}: {
  value: number;
  strong?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-3 py-2 text-right tabular-nums",
        strong && "font-medium",
      )}
    >
      {value ? formatMoney(value, "CLP") : "—"}
    </td>
  );
}

function ContactTable({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; rut: string; neto: number; docs: number }[];
}) {
  return (
    <div className="glass rounded-xl p-5">
      <h2 className="font-heading mb-3 text-base font-medium">{title}</h2>
      {rows.map((row) => (
        <div
          key={`${row.name}:${row.rut}`}
          className="border-border/60 flex justify-between gap-3 border-b py-2 text-sm"
        >
          <span>
            {row.name}
            <span className="text-muted-foreground block text-xs">
              {row.docs} documento(s)
            </span>
          </span>
          <span className="font-medium">{formatMoney(row.neto, "CLP")}</span>
        </div>
      ))}
    </div>
  );
}
