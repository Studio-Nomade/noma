import { formatMoney } from "@/lib/currency/format";

/**
 * Gráfico de barras liviano (sin dependencias) del flujo de caja mensual.
 * Ingresos hacia arriba, egresos hacia abajo, alineados a una línea base.
 */
export function FlujoBars({
  data,
}: {
  data: { periodo: string; ingresos: number; egresos: number; neto: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Sin movimientos bancarios todavía. Importa una cartola para ver el flujo.
      </p>
    );
  }
  const max = Math.max(
    1,
    ...data.map((d) => Math.max(d.ingresos, d.egresos)),
  );

  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-2">
      {data.map((d) => {
        const inH = Math.round((d.ingresos / max) * 80);
        const outH = Math.round((d.egresos / max) * 80);
        return (
          <div
            key={d.periodo}
            className="flex min-w-[42px] flex-1 flex-col items-center gap-1"
            title={`${d.periodo} · ingresos ${formatMoney(d.ingresos, "CLP")} · egresos ${formatMoney(d.egresos, "CLP")}`}
          >
            <div className="flex h-[80px] w-full flex-col justify-end">
              <div
                className="w-full rounded-t"
                style={{
                  height: `${inH}px`,
                  background: "var(--status-emerald)",
                }}
              />
            </div>
            <div className="flex h-[80px] w-full flex-col justify-start">
              <div
                className="w-full rounded-b"
                style={{ height: `${outH}px`, background: "var(--status-red)" }}
              />
            </div>
            <span className="text-muted-foreground text-[10px]">
              {d.periodo.slice(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
