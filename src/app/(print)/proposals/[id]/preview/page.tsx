import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatMoney } from "@/lib/currency/format";
import { getLatestRates } from "@/lib/currency/rates";
import { BRAND, AREA_THEME } from "@/lib/brand/brand";
import {
  getProposal,
  getProposalServices,
  getProposalTeam,
} from "@/features/proposals/queries";
import { computeTotals, type LineItem } from "@/features/proposals/totals";
import { computeGantt } from "@/features/proposals/gantt";
import { PrintButton } from "@/features/proposals/print-button";
import { AvatarCircle } from "@/components/shared/avatar-circle";

export const metadata = { title: "Vista previa" };

function Slide({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <section
      className="slide relative mx-auto flex w-full max-w-5xl flex-col bg-white p-14 text-[#1d1d1b] shadow-sm"
      style={{ aspectRatio: "16 / 9" }}
    >
      {accent && (
        <span
          className="absolute top-0 left-0 h-full w-1.5"
          style={{ background: accent }}
        />
      )}
      {children}
    </section>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading mb-4 text-2xl font-semibold tracking-tight">
      {children}
    </h2>
  );
}

export default async function ProposalPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getProposal(id);
  if (!row) notFound();
  const { proposal, clientName, projectName, projectArea, projectAreas } = row;
  const areas = projectAreas?.length ? projectAreas : [projectArea];
  const theme = AREA_THEME[projectArea];
  const areasLabel = areas.map((a) => AREA_THEME[a].label).join(" + ");
  const multiArea = areas.length > 1;

  const [selected, rates, team] = await Promise.all([
    getProposalServices(id),
    getLatestRates(),
    getProposalTeam(id),
  ]);
  const ufClp = Number(rates.ufClp) || 0;
  const items: LineItem[] = selected.map((s) => ({
    amount: Number(s.customPriceAmount ?? s.priceAmount) || null,
    currency: (s.customPriceCurrency ??
      s.priceCurrency ??
      "UF") as LineItem["currency"],
  }));
  const totals = computeTotals(items, ufClp);
  const gantt = computeGantt(proposal.timelineStages);
  const created = new Date(proposal.createdAt);
  const date = created.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  // Nombre del PDF: AREA_AAMMDD | Cliente - Proyecto
  const pad = (n: number) => String(n).padStart(2, "0");
  const code = `${String(created.getFullYear()).slice(2)}${pad(created.getMonth() + 1)}${pad(created.getDate())}`;
  const filename = `${projectArea}_${code} | ${clientName ?? "Cliente"} - ${projectName}`;

  const section = (title: string, value: string | null) =>
    value ? (
      <Slide accent={theme.accent} key={title}>
        <Heading>{title}</Heading>
        <p className="max-w-3xl text-base leading-relaxed whitespace-pre-wrap">
          {value}
        </p>
      </Slide>
    ) : null;

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body { background: #fff; }
          .no-print { display: none !important; }
          .slide {
            width: 100%; max-width: none; height: 100vh;
            box-shadow: none; page-break-after: always; break-after: page;
          }
          .deck { gap: 0 !important; padding: 0 !important; }
        }
      `}</style>

      {/* Barra de control (no se imprime) */}
      <div className="no-print border-border bg-card sticky top-0 z-10 flex items-center justify-between border-b px-6 py-3">
        <Link
          href={`/proposals/${id}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          Volver al editor
        </Link>
        <PrintButton filename={filename} />
      </div>

      <div className="deck mx-auto flex max-w-5xl flex-col gap-6 p-6">
        {/* Portada */}
        <Slide>
          <span
            className="absolute inset-x-0 top-0 h-2"
            style={{ background: theme.accent }}
          />
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-center justify-between">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BRAND.logo} alt={BRAND.name} className="h-10" />
              <span className="text-muted-foreground text-xs tracking-widest uppercase">
                Propuesta Comercial
              </span>
            </div>
            <div>
              <p
                className="mb-2 text-sm font-medium tracking-widest uppercase"
                style={{ color: theme.accent }}
              >
                {areasLabel}
              </p>
              <h1 className="font-heading text-5xl font-semibold tracking-tight">
                {proposal.title}
              </h1>
              <p className="text-muted-foreground mt-3 text-lg">
                {clientName ?? "—"} · {projectName}
              </p>
            </div>
            <p className="text-muted-foreground text-sm">
              {date} · v{proposal.version} · {BRAND.site}
            </p>
          </div>
        </Slide>

        {section("Contexto", proposal.context)}
        {section("Objetivo general", proposal.mainObjective)}
        {section("Alcance", proposal.scope)}

        {/* Servicios, agrupados por área */}
        {selected.length > 0 && (
          <Slide accent={theme.accent}>
            <Heading>Servicios incluidos</Heading>
            {[...new Set(selected.map((s) => s.area))].map((area) => (
              <div key={area} className="mb-4">
                {multiArea && (
                  <p
                    className="mb-1 text-xs font-medium tracking-widest uppercase"
                    style={{ color: theme.accent }}
                  >
                    {AREA_THEME[area].label}
                  </p>
                )}
                <ul className="divide-y divide-[#ecf0ee]">
                  {selected
                    .filter((s) => s.area === area)
                    .map((s) => (
                      <li
                        key={s.id}
                        className="flex items-baseline justify-between gap-4 py-2.5"
                      >
                        <div>
                          <p className="font-medium">{s.name}</p>
                          {s.subarea && (
                            <p className="text-muted-foreground text-xs">
                              {s.subarea}
                            </p>
                          )}
                        </div>
                        <span className="font-medium whitespace-nowrap">
                          {formatMoney(
                            s.customPriceAmount ?? s.priceAmount,
                            s.customPriceCurrency ?? s.priceCurrency ?? "UF",
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </Slide>
        )}

        {section("Etapas de trabajo", proposal.workStages)}
        {section("Entregables", proposal.deliverables)}
        {gantt && (
          <Slide accent={theme.accent}>
            <Heading>Cronograma</Heading>
            <div className="mt-2 space-y-2">
              {gantt.rows.map((r, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 truncate">{r.name}</span>
                  <div className="relative h-4 flex-1 rounded bg-[#ecf0ee]">
                    <div
                      className="absolute top-0 h-4 rounded"
                      style={{
                        left: `${r.leftPct}%`,
                        width: `${r.widthPct}%`,
                        background: theme.accent,
                      }}
                    />
                  </div>
                  <span className="text-muted-foreground w-44 shrink-0 text-right text-xs">
                    {r.start} → {r.end}
                  </span>
                </div>
              ))}
            </div>
          </Slide>
        )}

        {/* Equipo: grilla de avatares si hay equipo estructurado; si no, texto */}
        {team.length > 0 ? (
          <Slide accent={theme.accent}>
            <Heading>Equipo principal</Heading>
            <div className="mt-4 grid grid-cols-4 gap-x-6 gap-y-8">
              {team.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col items-center text-center"
                >
                  <AvatarCircle
                    name={m.name}
                    photoUrl={m.photoUrl}
                    className="size-24 text-xl"
                  />
                  <p className="mt-3 text-sm font-semibold">{m.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {m.roleInProject ?? m.roleTitle ?? ""}
                  </p>
                </div>
              ))}
            </div>
          </Slide>
        ) : (
          section("Equipo", proposal.team)
        )}

        {/* Inversión */}
        <Slide accent={theme.accent}>
          <Heading>Inversión</Heading>
          <div className="max-w-md space-y-2 text-base">
            <Row
              label="Subtotal"
              value={`${totals.subtotalUf.toLocaleString("es-CL")} UF`}
            />
            {totals.subtotalClpDirect > 0 && (
              <Row
                label="Ítems en CLP"
                value={formatMoney(totals.subtotalClpDirect, "CLP")}
              />
            )}
            <Row label="Neto" value={formatMoney(totals.netClp, "CLP")} />
            <Row label="IVA 19%" value={formatMoney(totals.iva, "CLP")} />
            <div className="mt-2 border-t border-[#ecf0ee] pt-2">
              <Row
                label="Total"
                value={formatMoney(totals.totalClp, "CLP")}
                strong
              />
            </div>
          </div>
          <p className="text-muted-foreground mt-4 text-xs">
            Valores en UF; conversión referencial UF{" "}
            {ufClp.toLocaleString("es-CL")}.
          </p>
        </Slide>

        {section("Condiciones comerciales", proposal.commercialConditions)}

        {/* Cierre */}
        <Slide accent={theme.accent}>
          <div className="flex h-full flex-col justify-center">
            <h2 className="font-heading text-4xl font-semibold">
              {BRAND.name}
            </h2>
            <p className="text-muted-foreground mt-2">{BRAND.tagline}</p>
            <div className="text-muted-foreground mt-6 space-y-0.5 text-sm">
              <p>{BRAND.email}</p>
              <p>{BRAND.site}</p>
              <p>{BRAND.phone}</p>
              <p>{BRAND.address}</p>
            </div>
          </div>
        </Slide>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-xl font-semibold" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}
