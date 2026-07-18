import { AREA_LABELS } from "@/types/enums";
import { AvatarCircle } from "@/components/shared/avatar-circle";
import { formatMoney } from "@/lib/currency/format";
import type { ProposalTemplateData } from "../types";
import { proposalAreaAccent, proposalTheme } from "../themes";
import { getAreaCover, getHeaderLogo, proposalFixedSlides } from "../assets";
import type { Area } from "@/types/enums";

function SlideFrame({
  children,
  dark = false,
  accent,
  area = null,
  chrome = true,
}: {
  children: React.ReactNode;
  dark?: boolean;
  accent?: string;
  area?: Area | null;
  chrome?: boolean;
}) {
  return (
    <section
      className={`proposal-slide relative mx-auto flex aspect-video w-full max-w-6xl overflow-hidden p-[5.5%] shadow-sm ${dark ? "text-white" : "text-[#1d1d1b]"}`}
      style={{
        background: dark ? proposalTheme.ink : proposalTheme.paper,
        borderColor: accent,
      }}
    >
      {chrome && (
        <>
          <span className="absolute top-[6%] left-[5.5%] text-[1.15vw] font-medium tracking-[.12em] uppercase">
            Studio
            <br />
            Nomade
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getHeaderLogo(area, dark ? "dark" : "light")}
            alt=""
            className="absolute top-[4.5%] right-[5.5%] h-[9.8%] w-[7.7%] object-contain"
          />
        </>
      )}
      <div className="proposal-body flex h-full w-full flex-col pt-[7%]">
        {children}
      </div>
      {chrome && (
        <span className="absolute right-[5.5%] bottom-[4%] text-[.75vw] tracking-widest uppercase">
          Studio Nomade®
        </span>
      )}
    </section>
  );
}

function DisplayTitle({
  children,
  accent = false,
  text,
}: {
  children: React.ReactNode;
  accent?: boolean;
  text?: string;
}) {
  return (
    <h2
      className="proposal-title max-w-full leading-[.88] font-black tracking-[-.035em] uppercase"
      style={{
        color: accent ? proposalTheme.orange : undefined,
        fontSize: text
          ? `${Math.max(2.6, Math.min(5.6, 105 / Math.max(text.length, 12)))}vw`
          : "5.6vw",
      }}
    >
      {children}
    </h2>
  );
}

function FixedSlide({ src, alt }: { src: string; alt: string }) {
  return (
    <section className="proposal-slide relative mx-auto aspect-video w-full max-w-6xl overflow-hidden shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-full w-full object-cover" />
      <span className="absolute right-[5.5%] bottom-[4%] text-[.75vw] tracking-widest text-white uppercase">
        Studio Nomade®
      </span>
    </section>
  );
}

function ContactLinks({ light = true }: { light?: boolean }) {
  return (
    <div
      className={`mt-[5%] flex flex-wrap justify-center gap-x-5 gap-y-1 text-[1.05vw] ${light ? "text-white" : "text-[#1d1d1b]"}`}
    >
      <a
        href="mailto:contact@studionomade.cl"
        className="underline-offset-4 hover:underline"
      >
        contact@studionomade.cl
      </a>
      <a
        href="mailto:sales@studionomade.cl"
        className="underline-offset-4 hover:underline"
      >
        sales@studionomade.cl
      </a>
      <a
        href="https://www.studionomade.cl"
        className="underline-offset-4 hover:underline"
      >
        www.studionomade.cl
      </a>
      <a
        href="https://maps.google.com/?q=Av.+Providencia+1208,+Of.+207,+Santiago,+Chile"
        className="underline-offset-4 hover:underline"
      >
        Av. Providencia 1208, Of. 207
      </a>
      <a
        href="https://maps.google.com/?q=Santa+Beatriz+100,+Of.+1101,+Santiago,+Chile"
        className="underline-offset-4 hover:underline"
      >
        Santa Beatriz 100, Of. 1101
      </a>
    </div>
  );
}

function OpeningClosingSlide() {
  return (
    <SlideFrame dark chrome={false}>
      <div className="flex h-full flex-col items-center justify-center text-center">
        <DisplayTitle>
          STUDIO
          <br />
          NOMADE
        </DisplayTitle>
        <ContactLinks />
      </div>
    </SlideFrame>
  );
}

function BankSlide() {
  const studioAreas = [
    {
      label: "Audiovisual",
      icon: "/assets/areas/aa-white.png",
    },
    {
      label: "Arquitectura",
      icon: "/assets/areas/ad-white.png",
    },
    {
      label: "Web Design",
      icon: "/assets/areas/wd-white.png",
    },
    { label: "Branding", icon: "/assets/areas/bd-white.png" },
  ];

  return (
    <SlideFrame dark accent={proposalTheme.orange}>
      <div className="grid h-full grid-cols-[.9fr_1.1fr] items-center gap-[10%]">
        <div className="text-[1.15vw] leading-[1.45] text-[#ecf0ee]">
          <p className="text-[1.35vw] font-semibold">RUT 77.333.406-4</p>
          <div className="my-[5%] h-px w-[78%] bg-[#ecf0ee]" />
          <p className="text-[.85vw] tracking-[.14em] uppercase">
            Razón social
          </p>
          <p className="mt-1 text-[1.25vw]">Studio Nomade SPA</p>
          <div className="my-[5%] h-px w-[78%] bg-[#ecf0ee]" />
          <p>Banco de Crédito e Inversiones</p>
          <p>Cta. Cte. Nº: 89784081</p>
          <div className="my-[5%] h-px w-[78%] bg-[#ecf0ee]" />
          <a className="block" href="mailto:contact@studionomade.cl">
            contact@studionomade.cl
          </a>
          <a className="block" href="mailto:sales@studionomade.cl">
            sales@studionomade.cl
          </a>
          <a className="block" href="https://www.studionomade.cl">
            www.studionomade.cl
          </a>
          <a
            className="block"
            href="https://maps.google.com/?q=Av.+Providencia+1208,+Of.+207,+Santiago,+Chile"
          >
            Av. Providencia 1208, Of. 207
          </a>
          <a
            className="block"
            href="https://maps.google.com/?q=Santa+Beatriz+100,+Of.+1101,+Santiago,+Chile"
          >
            Santa Beatriz 100, Of. 1101
          </a>
        </div>
        <div className="pl-[2%]">
          <p className="proposal-eyebrow mb-[4%] text-[1vw] tracking-[.18em] uppercase">
            Studio Nomade
          </p>
          <h2 className="proposal-title text-[2.8vw] leading-none uppercase">
            Información bancaria.
          </h2>
          <div className="mt-[9%] grid grid-cols-2 gap-x-[6%] gap-y-[9%]">
            {studioAreas.map((area) => (
              <div
                key={area.label}
                className="flex flex-col items-center pt-[7%]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={area.icon}
                  alt=""
                  className="h-[5.2vw] w-[8vw] object-contain"
                />
                <p className="proposal-title mt-[5%] text-[1vw] text-white uppercase">
                  {area.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

function TextSlide({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: string;
}) {
  return (
    <SlideFrame accent={accent}>
      <p
        className="proposal-eyebrow mb-[3%] text-[1vw] font-semibold tracking-[.18em] uppercase"
        style={{ color: accent }}
      >
        {title}
      </p>
      <div className="grid flex-1 grid-cols-[.75fr_1.25fr] items-center gap-[7%]">
        <DisplayTitle>{title}</DisplayTitle>
        <p className="text-[1.55vw] leading-[1.45] whitespace-pre-wrap">
          {value}
        </p>
      </div>
    </SlideFrame>
  );
}

export function ProposalDeck({ data }: { data: ProposalTemplateData }) {
  const accent = proposalAreaAccent[data.areas[0]];
  const textSlides = [
    ["Contexto", data.sections.context],
    ["Objetivo", data.sections.objective],
    ["Alcance", data.sections.scope],
  ] as const;
  return (
    <div className="proposal-deck flex flex-col gap-6">
      <style>{`
        @font-face { font-family: "Cook Gothif"; src: url("/assets/fonts/cook-gothif-bold.woff2") format("woff2"); font-weight: 700; font-display: swap; }
        @font-face { font-family: "San Diego"; src: url("/assets/fonts/san-diego-medium.woff") format("woff"); font-weight: 500; font-display: swap; }
        @font-face { font-family: "San Diego"; src: url("/assets/fonts/san-diego-semibold.woff") format("woff"); font-weight: 600; font-display: swap; }
        .proposal-title { font-family: "Cook Gothif", sans-serif; }
        .proposal-body { font-family: "San Diego", sans-serif; font-weight: 500; }
        .proposal-eyebrow { font-family: var(--font-sans), sans-serif; }
      `}</style>
      <OpeningClosingSlide />
      <SlideFrame dark accent={accent}>
        <div className="flex h-full flex-col justify-end">
          <p
            className="mb-[2%] text-[1.2vw] tracking-[.22em] uppercase"
            style={{ color: accent }}
          >
            Propuesta comercial · {data.proposalCode}
          </p>
          <DisplayTitle text={data.title}>{data.title}</DisplayTitle>
          <div className="mt-[4%] flex justify-between text-[1.35vw]">
            <span>
              {data.clientName} · {data.projectName}
            </span>
            <span>
              {data.areaLabel} · {data.year}
            </span>
          </div>
        </div>
      </SlideFrame>
      <FixedSlide
        src={proposalFixedSlides.manifesto}
        alt="Estrategia, autenticidad y creatividad"
      />
      {textSlides
        .filter((x) => Boolean(x[1]))
        .map(([title, value]) => (
          <TextSlide key={title} title={title} value={value!} accent={accent} />
        ))}
      <SlideFrame accent={accent}>
        <p className="mb-[3%] text-[1vw] tracking-[.18em] uppercase">
          Servicios seleccionados
        </p>
        <DisplayTitle text="ALCANCE">ALCANCE.</DisplayTitle>
        <div className="mt-auto grid grid-cols-2 gap-x-[6%] gap-y-[2%]">
          {data.services.map((service, index) => (
            <div
              key={service.id}
              className="flex border-t border-black/20 py-[2%] text-[1.2vw]"
            >
              <span className="mr-4" style={{ color: accent }}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{service.name}</span>
            </div>
          ))}
        </div>
      </SlideFrame>
      {data.areas.flatMap((area) => {
        const cover = getAreaCover(area);
        const areaServices = data.services.filter(
          (service) => service.area === area,
        );
        if (areaServices.length === 0) return [];
        const slides: React.ReactNode[] = [
          cover ? (
            <FixedSlide
              key={`cover-${area}`}
              src={cover}
              alt={AREA_LABELS[area]}
            />
          ) : (
            <SlideFrame
              key={`cover-${area}`}
              dark
              accent={proposalAreaAccent[area]}
              area={area}
            >
              <div className="flex h-full items-center">
                <DisplayTitle accent text={AREA_LABELS[area]}>
                  {AREA_LABELS[area]}
                </DisplayTitle>
              </div>
            </SlideFrame>
          ),
        ];
        slides.push(
          ...areaServices.map((service) => (
            <SlideFrame
              key={service.id}
              dark
              accent={proposalAreaAccent[service.area]}
              area={service.area}
            >
              <div className="grid h-full grid-cols-[1.1fr_.9fr] gap-[7%]">
                <div className="flex flex-col justify-center">
                  <p className="mb-[3%] text-[1vw] tracking-[.18em] uppercase">
                    {AREA_LABELS[service.area]}
                  </p>
                  <DisplayTitle text={service.name}>
                    {service.name}
                  </DisplayTitle>
                  <p
                    className="mt-[5%] text-[1.5vw] font-bold"
                    style={{ color: accent }}
                  >
                    {service.valueLabel}
                  </p>
                </div>
                <div className="flex flex-col justify-center text-[1.15vw] leading-[1.5]">
                  <p>{service.description}</p>
                  {service.deliverables.length > 0 && (
                    <>
                      <p className="mt-[8%] mb-[2%] font-bold uppercase">
                        Incluye
                      </p>
                      <ul className="space-y-1">
                        {service.deliverables.slice(0, 7).map((item) => (
                          <li key={item}>— {item}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </SlideFrame>
          )),
        );
        return slides;
      })}
      {data.sections.methodology && (
        <TextSlide
          title="Metodología"
          value={data.sections.methodology}
          accent={accent}
        />
      )}
      {data.sections.deliverables && (
        <TextSlide
          title="Entregables"
          value={data.sections.deliverables}
          accent={accent}
        />
      )}
      {data.gantt && (
        <SlideFrame dark accent={accent}>
          <DisplayTitle text="GANTT DESARROLLO">GANTT DESARROLLO</DisplayTitle>
          <div className="relative mt-[5%] h-[42%]">
            <div className="absolute inset-x-[20%] top-0 flex h-[12%] text-[.8vw] font-semibold text-white/70 uppercase">
              {data.gantt.monthLabels.map((month) => (
                <span
                  key={`${month.label}-${month.leftPct}`}
                  className="absolute"
                  style={{ left: `${month.leftPct}%` }}
                >
                  {month.label}
                </span>
              ))}
            </div>
            <div className="absolute inset-x-0 top-[18%] space-y-[1.2%]">
              {data.gantt.rows.map((row) => (
                <div
                  key={`${row.name}-${row.start}`}
                  className="grid grid-cols-[20%_1fr] items-center gap-4 text-[.82vw]"
                >
                  <span>{row.name}</span>
                  <div className="relative h-[1.15vw] bg-white/10">
                    <span
                      className="absolute top-0 flex h-full items-center justify-center bg-[#ecf0ee] px-2 text-[.64vw] font-semibold whitespace-nowrap text-[#1d1d1b]"
                      style={{
                        left: `${row.leftPct}%`,
                        width: `${row.widthPct}%`,
                      }}
                    >
                      {row.start} - {row.end}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {data.gantt.milestones.length > 0 && (
            <div className="mt-auto grid grid-cols-4 gap-[3%]">
              {data.gantt.milestones.slice(0, 4).map((milestone, index) => (
                <div
                  key={`${milestone.date}-${milestone.description}`}
                  className="border-t pt-[5%] text-[.78vw] leading-[1.35]"
                  style={{
                    borderColor: index % 2 === 0 ? "#ffd700" : "#7ed957",
                  }}
                >
                  <p
                    className="mb-2 font-semibold"
                    style={{ color: index % 2 === 0 ? "#ffd700" : "#7ed957" }}
                  >
                    {milestone.date}
                  </p>
                  <p className="text-white/85">{milestone.description}</p>
                </div>
              ))}
            </div>
          )}
        </SlideFrame>
      )}
      {data.team.length > 0 && (
        <SlideFrame dark accent={accent}>
          <DisplayTitle>
            EQUIPO
            <br />
            <span style={{ color: accent }}>PRINCIPAL.</span>
          </DisplayTitle>
          <div className="mt-auto grid grid-cols-5 gap-[3%]">
            {data.team.slice(0, 5).map((member) => (
              <div key={member.id} className="text-center">
                <AvatarCircle
                  name={member.name}
                  photoUrl={member.photoUrl}
                  className="mx-auto size-[9vw] border-2 border-white grayscale"
                />
                <p className="mt-3 text-[1.05vw] font-bold">{member.name}</p>
                <p className="text-[.9vw] text-white/70">{member.role}</p>
              </div>
            ))}
          </div>
        </SlideFrame>
      )}
      <SlideFrame accent={accent}>
        <DisplayTitle text="INVERSIÓN">INVERSIÓN.</DisplayTitle>
        <div className="mt-auto ml-auto w-[48%] text-[1.25vw]">
          {data.totals.oneTimeUf > 0 && (
            <InvestmentRow
              label="Valor único"
              value={`${data.totals.oneTimeUf.toLocaleString("es-CL")} UF + IVA`}
            />
          )}
          {data.totals.monthlyUf > 0 && (
            <InvestmentRow
              label="Valor mensual"
              value={`${data.totals.monthlyUf.toLocaleString("es-CL")} UF + IVA`}
            />
          )}
          {data.totals.quarterlyUf > 0 && (
            <InvestmentRow
              label="Valor trimestral"
              value={`${data.totals.quarterlyUf.toLocaleString("es-CL")} UF + IVA`}
            />
          )}
          <InvestmentRow
            label="Neto referencial"
            value={formatMoney(data.totals.netClp, "CLP")}
          />
          <InvestmentRow
            label="IVA 19%"
            value={formatMoney(data.totals.ivaClp, "CLP")}
          />
          <InvestmentRow
            label="Total referencial"
            value={formatMoney(data.totals.totalClp, "CLP")}
            strong
          />
          <p className="mt-4 text-[.8vw] opacity-60">
            UF referencial: {formatMoney(data.totals.ufClp, "CLP")}. Recurrentes
            se presentan separados.
          </p>
        </div>
      </SlideFrame>
      {data.sections.commercialConditions && (
        <TextSlide
          title="Condiciones"
          value={data.sections.commercialConditions}
          accent={accent}
        />
      )}
      {data.sections.exclusions && (
        <TextSlide
          title="No considera"
          value={data.sections.exclusions}
          accent={accent}
        />
      )}
      {data.sections.nextSteps && (
        <TextSlide
          title="Próximos pasos"
          value={data.sections.nextSteps}
          accent={accent}
        />
      )}
      <BankSlide />
      <OpeningClosingSlide />
    </div>
  );
}

function InvestmentRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between border-b border-black/20 py-[2%] ${strong ? "text-[1.6vw] font-black" : ""}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
