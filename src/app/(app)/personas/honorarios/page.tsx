import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/currency/format";
import { getHonorariaBook } from "@/features/people/honoraria";
import { PeopleTabs } from "@/features/people/people-tabs";

export default async function HonorariaPage() {
  const rows = await getHonorariaBook();
  return (
    <>
      <PeopleTabs current="honoraria" />
      <PageHeader
        title="Libro de Honorarios"
        description="Boletas de terceros, retenciones, pagos y clasificación contable"
      />
      <div className="glass-solid overflow-x-auto rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-border border-b text-left text-xs">
              <th className="px-4 py-3">Emisión / folio</th>
              <th className="px-4 py-3">Prestador</th>
              <th className="px-4 py-3 text-right">Bruto</th>
              <th className="px-4 py-3 text-right">Retención</th>
              <th className="px-4 py-3 text-right">Por pagar</th>
              <th className="px-4 py-3">Cuenta / estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-border/60 border-b">
                <td className="px-4 py-3">
                  <span className="block">{row.emissionDate}</span>
                  <span className="text-muted-foreground text-xs">
                    #{row.folio}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="block">{row.contactName ?? "Sin nombre"}</span>
                  <span className="text-muted-foreground text-xs">
                    {row.contactRut ?? "Sin RUT"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(row.gross, "CLP")}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(row.retention, "CLP")}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatMoney(row.balance, "CLP")}
                </td>
                <td className="px-4 py-3">
                  <span className="block text-xs">
                    {row.accountName ?? "Pendiente de clasificar"}
                  </span>
                  <StatusBadge value={row.status} size="xs" />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground px-4 py-8 text-center"
                >
                  No hay boletas de honorarios importadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
