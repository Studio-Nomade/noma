import Link from "next/link";
import { AlertTriangle, BookOpen, HelpCircle, Sparkles } from "lucide-react";
import type { Area } from "@/types/enums";
import type { DraftRunView } from "./queries";
import { TeachForm } from "./teach-form";

const CONFIDENCE_LABEL = {
  alta: "Confianza alta",
  media: "Confianza media",
  baja: "Confianza baja",
} as const;

function money(value: number | null, currency: string) {
  if (value == null) return "valor del catálogo";
  return `${value.toLocaleString("es-CL", { maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Panel del borrador de IA en la propuesta: por qué propuso cada servicio y
 * valor, qué falta confirmar con el cliente, qué memoria y precedentes usó, y
 * el formulario para enseñarle a Noma. Sin borrador, solo muestra "Enseñar".
 */
export function AiDraftPanel({
  run,
  proposalId,
  area,
}: {
  run: DraftRunView | null;
  proposalId: string;
  area: Area;
}) {
  const draft = run?.draft;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4" />
          Cotizador con IA
        </h2>
        <Link
          href="/proposals/memoria"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <BookOpen className="size-3.5" />
          Memoria
        </Link>
      </div>

      {run && draft ? (
        <>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">
              Borrador de {run.model ?? "IA"} ·{" "}
              {run.createdAt.toLocaleString("es-CL", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Santiago",
              })}{" "}
              · {CONFIDENCE_LABEL[draft.confidence]}
            </p>
            <p className="text-sm whitespace-pre-wrap">
              {draft.summary_for_team}
            </p>
            {run.instructions && (
              <p className="text-muted-foreground text-xs">
                Indicaciones: {run.instructions}
              </p>
            )}
          </div>

          {run.warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
              {run.warnings.map((warning) => (
                <li key={warning} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                  {warning}
                </li>
              ))}
            </ul>
          )}

          <details className="group" open>
            <summary className="cursor-pointer text-xs font-medium uppercase">
              Por qué cada servicio y valor ({run.lines.length})
            </summary>
            <ul className="mt-2 space-y-3">
              {run.lines.map((line, index) => (
                <li
                  key={`${line.label}-${index}`}
                  className="border-border border-l-2 pl-3"
                >
                  <p className="text-sm font-medium">
                    {line.label}
                    {line.kind === "personalizado" && (
                      <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 uppercase">
                        nuevo · en revisión
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {line.tier} · {line.quantity} ×{" "}
                    {money(line.unitPrice, line.currency)}
                  </p>
                  <p className="mt-1 text-xs whitespace-pre-wrap">
                    {line.rationale}
                  </p>
                </li>
              ))}
            </ul>
          </details>

          {draft.discount && (
            <p className="text-xs">
              <strong>Descuento sugerido:</strong> {draft.discount.label} (
              {draft.discount.value}
              {draft.discount.kind === "percent" ? " %" : " UF"}).{" "}
              {draft.discount.rationale}
            </p>
          )}

          {draft.open_questions.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase">
                <HelpCircle className="size-3.5" />
                Confirmar con el cliente
              </p>
              <ul className="list-disc space-y-1 pl-5 text-xs">
                {draft.open_questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>
          )}

          {(run.learnings.length > 0 || run.precedents.length > 0) && (
            <details>
              <summary className="cursor-pointer text-xs font-medium uppercase">
                Memoria y precedentes usados
              </summary>
              <ul className="mt-2 space-y-1 text-xs">
                {run.learnings.map((learning) => (
                  <li
                    key={learning.id}
                    className={learning.active ? "" : "line-through opacity-60"}
                  >
                    • {learning.statement}
                  </li>
                ))}
                {run.precedents.map((precedent) => (
                  <li key={precedent.id} className="text-muted-foreground">
                    ↳ {precedent.code ?? "s/código"} ·{" "}
                    {precedent.clientName ?? "—"} · {precedent.title}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-xs">
          Esta propuesta no tiene borrador de IA. Igual puedes enseñarle a Noma
          algo que deba aplicar en las próximas propuestas.
        </p>
      )}

      <div className="border-border border-t pt-4">
        <p className="mb-2 text-xs font-medium uppercase">Enseñar a Noma</p>
        <TeachForm proposalId={proposalId} defaultArea={area} />
        <p className="text-muted-foreground mt-2 text-xs">
          Al enviar, aprobar o rechazar la propuesta, Noma compara el borrador
          con lo que quedó y aprende solo de los cambios.
        </p>
      </div>
    </div>
  );
}
