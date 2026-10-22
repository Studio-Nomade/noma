import { CalendarClock } from "lucide-react";
import { formatMoney } from "@/lib/currency/format";
import { formatDate } from "../helpers";
import { runFollowupNow, updateCobranzaCase } from "./actions";
import { FOLLOWUP_REASON_LABELS } from "./followup";
import type { FollowupCandidate } from "./followup-run";

/**
 * Panel del seguimiento a 7 días: muestra cada factura de venta abierta, si le
 * toca P3 y por qué no cuando se suprime. Permite registrar fecha comprometida,
 * cesión a factoring, cobranza legal o pausa.
 */
export function FollowupPanel({
  candidates,
  autosend,
}: {
  candidates: FollowupCandidate[];
  autosend: boolean;
}) {
  const toSend = candidates.filter((c) => c.decision.send);
  const sorted = [...candidates].sort(
    (a, b) =>
      Number(b.decision.send) - Number(a.decision.send) ||
      b.decision.daysSinceSent - a.decision.daysSinceSent,
  );

  return (
    <section className="mb-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading flex items-center gap-2 text-base font-medium">
          <CalendarClock className="size-4" /> Seguimiento a 7 días
        </h2>
        <form action={runFollowupNow}>
          <button
            type="submit"
            className="border-border rounded-md border px-3 py-1.5 text-xs"
            disabled={toSend.length === 0}
          >
            {autosend
              ? `Enviar seguimientos (${toSend.length})`
              : `Generar borradores (${toSend.length})`}
          </button>
        </form>
      </div>
      <p className="text-muted-foreground mb-3 text-xs">
        {autosend
          ? "Envío automático activo: el cron de días hábiles envía los P3 desde sales@."
          : "Modo borrador: el seguimiento deja los P3 en el historial como pendientes; revísalos y envíalos con «Reintentar»."}
      </p>

      {candidates.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed px-6 py-8 text-center text-sm">
          No hay facturas de venta abiertas. Importa las ventas de Nubox para
          activar el seguimiento.
        </div>
      ) : (
        <div className="glass-solid overflow-x-auto rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-xs">
                <th className="px-4 py-3">Factura</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3 text-right">Pendiente</th>
                <th className="px-4 py-3">Días</th>
                <th className="px-4 py-3">Seguimiento</th>
                <th className="px-4 py-3">Ajustes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr
                  key={c.documentId}
                  className="border-border/60 border-b align-top"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium">#{c.folio}</span>
                    <span className="text-muted-foreground block text-xs">
                      {formatDate(c.fechaEmision)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block max-w-[200px] truncate">
                      {c.clientName ?? c.contactName}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {c.email ?? "Sin correo de cobranza"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(c.pendiente, "CLP")}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {c.decision.daysSinceSent}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={
                        c.decision.send
                          ? "font-medium text-[var(--status-amber)]"
                          : "text-muted-foreground"
                      }
                    >
                      {FOLLOWUP_REASON_LABELS[c.decision.reason]}
                    </span>
                    {c.decision.nextDate && !c.decision.send && (
                      <span className="text-muted-foreground block">
                        Próximo: {formatDate(c.decision.nextDate)}
                      </span>
                    )}
                    {c.followupCount > 0 && (
                      <span className="text-muted-foreground block">
                        Seguimientos: {c.followupCount}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <details>
                      <summary className="cursor-pointer text-xs text-[var(--status-blue)]">
                        Editar
                      </summary>
                      <form
                        action={updateCobranzaCase}
                        className="mt-2 grid min-w-[220px] gap-2 text-xs"
                      >
                        <input
                          type="hidden"
                          name="documentId"
                          value={c.documentId}
                        />
                        <label className="grid gap-1">
                          Fecha comprometida
                          <input
                            type="date"
                            name="committedPaymentDate"
                            defaultValue={c.committedPaymentDate ?? ""}
                            className="border-border rounded border bg-transparent px-2 py-1"
                          />
                        </label>
                        <label className="grid gap-1">
                          Factoring (si fue cedida)
                          <input
                            name="factoringEntity"
                            defaultValue={c.factoringEntity ?? ""}
                            placeholder="Entidad de factoring"
                            className="border-border rounded border bg-transparent px-2 py-1"
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="legal"
                            defaultChecked={Boolean(c.legalAt)}
                          />
                          En cobranza legal
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="paused"
                            defaultChecked={c.paused}
                          />
                          Pausar seguimiento
                        </label>
                        <button
                          type="submit"
                          className="bg-foreground text-background rounded px-2 py-1"
                        >
                          Guardar
                        </button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
