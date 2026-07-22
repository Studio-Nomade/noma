import { formatMoney } from "@/lib/currency/format";
import { AREA_LABELS, type Area, type Currency } from "@/types/enums";
import { AvatarCircle } from "@/components/shared/avatar-circle";
import type { Proposal } from "@/db/schema";
import type { ProposalServiceRow, ProposalTeamRow } from "./queries";
import type { ProposalTotals } from "./totals";
import { computeGantt } from "./gantt";
import { parseStructuredContent } from "./structured-content";

/** Vista de solo lectura de la propuesta (cuando está Aprobada). */
export function ProposalReadonly({
  proposal,
  services,
  team,
  totals,
  accent,
}: {
  proposal: Proposal;
  services: ProposalServiceRow[];
  team: ProposalTeamRow[];
  totals: ProposalTotals;
  accent: string;
}) {
  const areas = [...new Set(services.map((s) => s.area))] as Area[];
  const multiArea = areas.length > 1;
  const gantt = computeGantt(proposal.timelineStages);
  const workStages = parseStructuredContent(proposal.workStages, "stages");
  const deliverables = parseStructuredContent(
    proposal.deliverables,
    "deliverables",
  );
  const sectionDefs: [string, string | null][] = [
    ["Contexto", proposal.context],
    ["Objetivo general", proposal.mainObjective],
    ["Alcance", proposal.scope],
    ["Exclusiones", proposal.exclusions],
    ["Condiciones comerciales", proposal.commercialConditions],
  ];
  const structuredSections = [
    { label: "Etapas de trabajo", items: workStages },
    { label: "Entregables", items: deliverables },
  ];

  return (
    <div className="space-y-6">
      {/* Servicios */}
      <div className="glass rounded-xl p-6">
        <h2 className="font-heading mb-3 text-sm font-medium">Servicios</h2>
        {areas.map((area) => (
          <div key={area} className="mb-3">
            {multiArea && (
              <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
                {area} · {AREA_LABELS[area]}
              </p>
            )}
            <ul className="divide-border divide-y">
              {services
                .filter((s) => s.area === area)
                .map((s) => (
                  <li
                    key={s.id}
                    className="flex justify-between gap-3 py-2 text-sm"
                  >
                    <span>{s.name}</span>
                    <span className="font-medium">
                      {formatMoney(
                        s.customPriceAmount ?? s.priceAmount,
                        (s.customPriceCurrency ??
                          s.priceCurrency ??
                          "UF") as Currency,
                      )}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
        <div className="border-border mt-3 flex justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">Total (IVA incl.)</span>
          <span className="font-semibold">
            {formatMoney(totals.totalClp, "CLP")}
          </span>
        </div>
      </div>

      {/* Equipo */}
      {team.length > 0 && (
        <div className="glass rounded-xl p-6">
          <h2 className="font-heading mb-3 text-sm font-medium">Equipo</h2>
          <div className="flex flex-wrap gap-4">
            {team.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <AvatarCircle
                  name={m.name}
                  photoUrl={m.photoUrl}
                  className="size-9 text-xs"
                />
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {m.roleInProject ?? m.roleTitle ?? ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cronograma */}
      {gantt && (
        <div className="glass rounded-xl p-6">
          <h2 className="font-heading mb-3 text-sm font-medium">Cronograma</h2>
          <div className="space-y-1.5">
            {gantt.rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0 truncate">{r.name}</span>
                <div className="relative h-3 flex-1 rounded bg-[var(--accent)]">
                  <div
                    className="absolute top-0 h-3 rounded"
                    style={{
                      left: `${r.leftPct}%`,
                      width: `${r.widthPct}%`,
                      background: accent,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Secciones */}
      <div className="glass space-y-4 rounded-xl p-6">
        {sectionDefs
          .filter(([, v]) => v && v.trim())
          .map(([label, v]) => (
            <div key={label}>
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                {label}
              </p>
              <p className="mt-0.5 text-sm whitespace-pre-wrap">{v}</p>
            </div>
          ))}
        {structuredSections.map(({ label, items }) =>
          items.length > 0 ? (
            <div key={label}>
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                {label}
              </p>
              <ul className="mt-2 space-y-2">
                {items.map((item, index) => (
                  <li key={`${item.title}-${index}`} className="text-sm">
                    <strong>{item.title}</strong>
                    {item.description && (
                      <p className="text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
