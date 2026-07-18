import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { BRAND } from "@/lib/brand/brand";
import { AREA_LABELS } from "@/types/enums";
import { formatMoney } from "@/lib/currency/format";
import { proposalAreaAccent, proposalTheme } from "./templates/themes";
import type { ProposalTemplateData } from "./templates/types";
import { getAreaCover, getHeaderLogo, pdfAssetPath } from "./templates/assets";
import type { Area } from "@/types/enums";
import type { StructuredContentItem } from "./structured-content";

export type ProposalPdfData = ProposalTemplateData;

Font.registerHyphenationCallback((word) => [word]);
Font.register({
  family: "Cook Gothif",
  src: pdfAssetPath("/assets/fonts/cook-gothif-bold.ttf"),
  fontWeight: 700,
});
Font.register({
  family: "San Diego",
  fonts: [
    {
      src: pdfAssetPath("/assets/fonts/san-diego-medium.ttf"),
      fontWeight: 500,
    },
    {
      src: pdfAssetPath("/assets/fonts/san-diego-semibold.ttf"),
      fontWeight: 600,
    },
  ],
});

const s = StyleSheet.create({
  page: {
    width: 960,
    height: 540,
    padding: 54,
    fontFamily: "San Diego",
    fontWeight: 500,
    backgroundColor: proposalTheme.paper,
    color: proposalTheme.ink,
  },
  dark: { backgroundColor: proposalTheme.ink, color: proposalTheme.white },
  mast: {
    position: "absolute",
    top: 34,
    left: 54,
    fontSize: 9,
    lineHeight: 1.05,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  headerLogo: {
    position: "absolute",
    top: 24,
    right: 54,
    width: 59,
    height: 53,
    objectFit: "contain",
  },
  footer: {
    position: "absolute",
    right: 54,
    bottom: 26,
    fontSize: 6,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  body: { flex: 1, paddingTop: 48 },
  display: {
    fontFamily: "Cook Gothif",
    fontWeight: 700,
    fontSize: 58,
    lineHeight: 1.08,
    letterSpacing: -0.6,
    textTransform: "uppercase",
  },
  eyebrow: {
    fontFamily: "Helvetica",
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  copy: { fontSize: 12.5, lineHeight: 1.42 },
  grid: { flexDirection: "row", alignItems: "center", flex: 1, gap: 45 },
  half: { width: "50%" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: "#7b7b78",
    paddingVertical: 8,
    fontSize: 11,
  },
  small: { fontSize: 9, lineHeight: 1.45 },
});

function DeckPage({
  children,
  dark = false,
  accent,
  area = null,
  chrome = true,
}: {
  children: React.ReactNode;
  dark?: boolean;
  accent: string;
  area?: Area | null;
  chrome?: boolean;
}) {
  return (
    <Page
      size={[960, 540]}
      style={[s.page, dark ? s.dark : {}, { borderColor: accent }]}
    >
      {chrome && <Text style={s.mast}>Studio{"\n"}Nomade</Text>}
      {chrome && (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image
          style={s.headerLogo}
          src={pdfAssetPath(getHeaderLogo(area, dark ? "dark" : "light"))}
        />
      )}
      <View style={s.body}>{children}</View>
      {chrome && <Text style={s.footer}>Studio Nomade®</Text>}
    </Page>
  );
}

function titleSize(value: string, max = 58): number {
  return Math.max(
    27,
    Math.min(max, Math.round(1450 / Math.max(value.length, 20))),
  );
}

function FixedPdfPage({ src }: { src: string }) {
  return (
    <Page size={[960, 540]}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={pdfAssetPath(src)} style={{ width: 960, height: 540 }} />
      <Text style={[s.footer, { color: proposalTheme.white }]}>
        Studio Nomade®
      </Text>
    </Page>
  );
}

const contactStyle = {
  color: proposalTheme.white,
  textDecoration: "none",
  fontSize: 9,
  marginHorizontal: 6,
} as const;

function ContactLinks() {
  return (
    <View
      style={{
        marginTop: 25,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        width: 680,
      }}
    >
      <Link src="mailto:contact@studionomade.cl" style={contactStyle}>
        contact@studionomade.cl
      </Link>
      <Link src="mailto:sales@studionomade.cl" style={contactStyle}>
        sales@studionomade.cl
      </Link>
      <Link src="https://www.studionomade.cl" style={contactStyle}>
        www.studionomade.cl
      </Link>
      <Link
        src="https://maps.google.com/?q=Av.+Providencia+1208,+Of.+207,+Santiago,+Chile"
        style={contactStyle}
      >
        Av. Providencia 1208, Of. 207
      </Link>
      <Link
        src="https://maps.google.com/?q=Santa+Beatriz+100,+Of.+1101,+Santiago,+Chile"
        style={contactStyle}
      >
        Santa Beatriz 100, Of. 1101
      </Link>
    </View>
  );
}

function OpeningClosingPage({ accent }: { accent: string }) {
  return (
    <DeckPage dark accent={accent} chrome={false}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={[s.display, { textAlign: "center" }]}>
          STUDIO{"\n"}NOMADE
        </Text>
        <ContactLinks />
      </View>
    </DeckPage>
  );
}

function BankPdfPage({ accent }: { accent: string }) {
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
    <DeckPage dark accent={accent}>
      <View style={[s.grid, { gap: 70 }]}>
        <View style={{ width: "43%", color: proposalTheme.paper }}>
          <Text style={{ fontSize: 15, fontWeight: 600 }}>
            RUT 77.333.406-4
          </Text>
          <View
            style={{
              marginVertical: 16,
              width: "78%",
              height: 1,
              backgroundColor: proposalTheme.paper,
            }}
          />
          <Text style={[s.eyebrow, { marginBottom: 5 }]}>Razón social</Text>
          <Text style={{ fontSize: 14 }}>Studio Nomade SPA</Text>
          <View
            style={{
              marginVertical: 16,
              width: "78%",
              height: 1,
              backgroundColor: proposalTheme.paper,
            }}
          />
          <Text style={{ fontSize: 12, lineHeight: 1.45 }}>
            Banco de Crédito e Inversiones{"\n"}Cta. Cte. Nº: 89784081
          </Text>
          <View
            style={{
              marginVertical: 16,
              width: "78%",
              height: 1,
              backgroundColor: proposalTheme.paper,
            }}
          />
          <Link
            src="mailto:contact@studionomade.cl"
            style={[contactStyle, { marginHorizontal: 0 }]}
          >
            contact@studionomade.cl
          </Link>
          <Link
            src="mailto:sales@studionomade.cl"
            style={[contactStyle, { marginHorizontal: 0 }]}
          >
            sales@studionomade.cl
          </Link>
          <Link
            src="https://www.studionomade.cl"
            style={[contactStyle, { marginHorizontal: 0 }]}
          >
            www.studionomade.cl
          </Link>
          <Link
            src="https://maps.google.com/?q=Av.+Providencia+1208,+Of.+207,+Santiago,+Chile"
            style={[contactStyle, { marginHorizontal: 0 }]}
          >
            Av. Providencia 1208, Of. 207
          </Link>
          <Link
            src="https://maps.google.com/?q=Santa+Beatriz+100,+Of.+1101,+Santiago,+Chile"
            style={[contactStyle, { marginHorizontal: 0 }]}
          >
            Santa Beatriz 100, Of. 1101
          </Link>
        </View>
        <View style={{ width: "57%", paddingLeft: 10 }}>
          <Text style={s.eyebrow}>Studio Nomade</Text>
          <Text style={[s.display, { fontSize: 28, lineHeight: 1 }]}>
            INFORMACIÓN BANCARIA.
          </Text>
          <View
            style={{
              marginTop: 30,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 18,
            }}
          >
            {studioAreas.map((area) => (
              <View
                key={area.label}
                style={{
                  width: "45%",
                  height: 92,
                  paddingTop: 10,
                  alignItems: "center",
                }}
              >
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image
                  src={pdfAssetPath(area.icon)}
                  style={{ width: 88, height: 52, objectFit: "contain" }}
                />
                <Text
                  style={{
                    marginTop: 7,
                    fontFamily: "Cook Gothif",
                    fontSize: 9,
                    color: proposalTheme.white,
                    textTransform: "uppercase",
                  }}
                >
                  {area.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </DeckPage>
  );
}

function pdfImageSource(src: string): string {
  return src.startsWith("/") ? pdfAssetPath(src) : src;
}

function TextPage({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: string;
}) {
  return (
    <DeckPage accent={accent}>
      <Text style={[s.eyebrow, { color: accent }]}>{title}</Text>
      <View style={s.grid}>
        <Text style={[s.display, s.half, { fontSize: titleSize(title) }]}>
          {title}
        </Text>
        <Text style={[s.copy, s.half]}>{value}</Text>
      </View>
    </DeckPage>
  );
}

function StructuredListPdfPage({
  title,
  items,
  accent,
}: {
  title: string;
  items: StructuredContentItem[];
  accent: string;
}) {
  return (
    <DeckPage accent={accent}>
      <Text style={[s.eyebrow, { color: accent }]}>{title}</Text>
      <View style={s.grid}>
        <Text style={[s.display, s.half, { fontSize: titleSize(title) }]}>
          {title}
        </Text>
        <View style={s.half}>
          {items.slice(0, 8).map((item, index) => (
            <View
              key={`${item.title}-${index}`}
              style={{
                borderTopWidth: 0.5,
                borderTopColor: "#aaa",
                paddingVertical: 6,
              }}
            >
              <View style={{ flexDirection: "row" }}>
                <Text style={{ width: 28, fontSize: 8, color: accent }}>
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <Text style={{ flex: 1, fontSize: 10.5, fontWeight: 600 }}>
                  {item.title}
                </Text>
              </View>
              {item.description && (
                <Text
                  style={{
                    marginTop: 3,
                    marginLeft: 28,
                    fontSize: 8.5,
                    lineHeight: 1.35,
                    color: "#5e5e5b",
                  }}
                >
                  {item.description}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>
    </DeckPage>
  );
}

function ProposalPdf({ data }: { data: ProposalTemplateData }) {
  const accent = proposalAreaAccent[data.areas[0]];
  const textSlides = [
    ["Contexto", data.sections.context],
    ["Objetivo", data.sections.objective],
    ["Alcance", data.sections.scope],
  ] as const;
  return (
    <Document
      title={data.title}
      author={BRAND.name}
      subject={`Propuesta comercial ${data.proposalCode}`}
    >
      <OpeningClosingPage accent={accent} />
      <DeckPage dark accent={accent}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Text style={[s.eyebrow, { color: accent }]}>
            Propuesta comercial · {data.proposalCode}
          </Text>
          <Text style={[s.display, { fontSize: titleSize(data.title) }]}>
            {data.title}
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 22,
              fontSize: 12,
            }}
          >
            <Text>
              {data.clientName} · {data.projectName}
            </Text>
            <Text>
              {data.areaLabel} · {data.year}
            </Text>
          </View>
        </View>
      </DeckPage>
      <FixedPdfPage src="/assets/proposals/slides/manifesto.png" />
      {textSlides
        .filter((entry) => Boolean(entry[1]))
        .map(([title, value]) => (
          <TextPage key={title} title={title} value={value!} accent={accent} />
        ))}
      <DeckPage accent={accent}>
        <Text style={s.eyebrow}>Servicios seleccionados</Text>
        <Text style={s.display}>ALCANCE.</Text>
        <View
          style={{ marginTop: "auto", flexDirection: "row", flexWrap: "wrap" }}
        >
          {data.services.map((service, index) => (
            <View
              key={service.id}
              style={{
                width: "50%",
                flexDirection: "row",
                borderTopWidth: 0.5,
                borderTopColor: "#777",
                paddingVertical: 8,
              }}
            >
              <Text style={{ width: 28, color: accent, fontSize: 10 }}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <Text style={{ fontSize: 11 }}>{service.name}</Text>
            </View>
          ))}
        </View>
      </DeckPage>
      {data.areas.flatMap((area) => {
        const cover = getAreaCover(area);
        const areaServices = data.services.filter(
          (service) => service.area === area,
        );
        if (areaServices.length === 0) return [];
        const slides: React.ReactNode[] = [
          cover ? (
            <FixedPdfPage key={`cover-${area}`} src={cover} />
          ) : (
            <DeckPage
              key={`cover-${area}`}
              dark
              accent={proposalAreaAccent[area]}
              area={area}
            >
              <View style={{ flex: 1, justifyContent: "center" }}>
                <Text
                  style={[
                    s.display,
                    {
                      color: proposalAreaAccent[area],
                      fontSize: titleSize(AREA_LABELS[area]),
                    },
                  ]}
                >
                  {AREA_LABELS[area]}
                </Text>
              </View>
            </DeckPage>
          ),
        ];
        slides.push(
          ...areaServices.map((service) => (
            <DeckPage
              key={service.id}
              dark
              accent={proposalAreaAccent[service.area]}
              area={service.area}
            >
              <View style={s.grid}>
                <View style={s.half}>
                  <Text style={s.eyebrow}>{AREA_LABELS[service.area]}</Text>
                  <Text
                    style={[
                      s.display,
                      { fontSize: titleSize(service.name, 43) },
                    ]}
                  >
                    {service.name}
                  </Text>
                  <Text style={{ marginTop: 20, fontSize: 15, color: accent }}>
                    {service.valueLabel}
                  </Text>
                </View>
                <View style={s.half}>
                  <Text style={s.copy}>
                    {service.description ??
                      "Servicio seleccionado para esta propuesta."}
                  </Text>
                  {service.deliverables.length > 0 && (
                    <View style={{ marginTop: 22 }}>
                      <Text
                        style={[s.eyebrow, { fontFamily: "Helvetica-Bold" }]}
                      >
                        Incluye
                      </Text>
                      {service.deliverables.slice(0, 7).map((item) => (
                        <Text key={item} style={s.small}>
                          — {item}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </DeckPage>
          )),
        );
        return slides;
      })}
      {Boolean(data.sections.methodology?.length) && (
        <StructuredListPdfPage
          title="Metodología"
          items={data.sections.methodology!}
          accent={accent}
        />
      )}
      {Boolean(data.sections.deliverables?.length) && (
        <StructuredListPdfPage
          title="Entregables"
          items={data.sections.deliverables!}
          accent={accent}
        />
      )}
      {data.gantt && (
        <DeckPage dark accent={accent}>
          <Text style={[s.display, { fontSize: 48 }]}>GANTT DESARROLLO</Text>
          <View style={{ marginTop: 26, height: 190 }}>
            <View
              style={{ marginLeft: "22%", height: 18, position: "relative" }}
            >
              {data.gantt.monthLabels.map((month) => (
                <Text
                  key={`${month.label}-${month.leftPct}`}
                  style={{
                    position: "absolute",
                    left: `${month.leftPct}%`,
                    fontSize: 7,
                    color: "#bcbdbb",
                    textTransform: "uppercase",
                  }}
                >
                  {month.label}
                </Text>
              ))}
            </View>
            {data.gantt.rows.map((row) => (
              <View
                key={`${row.name}-${row.start}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <Text style={{ width: "22%", fontSize: 8 }}>{row.name}</Text>
                <View
                  style={{
                    width: "55%",
                    height: 10,
                    backgroundColor: "#343431",
                  }}
                >
                  <View
                    style={{
                      marginLeft: `${row.leftPct}%`,
                      width: `${row.widthPct}%`,
                      height: 10,
                      backgroundColor: proposalTheme.paper,
                    }}
                  />
                </View>
                <Text
                  style={{
                    width: "23%",
                    textAlign: "right",
                    fontSize: 7,
                    color: "#bcbdbb",
                  }}
                >
                  {row.start} - {row.end}
                </Text>
              </View>
            ))}
          </View>
          {data.gantt.milestones.length > 0 && (
            <View style={{ marginTop: "auto", flexDirection: "row", gap: 18 }}>
              {data.gantt.milestones.slice(0, 4).map((milestone, index) => (
                <View
                  key={`${milestone.date}-${milestone.title}`}
                  style={{
                    width: "24%",
                    borderTopWidth: 1,
                    borderTopColor: index % 2 === 0 ? "#ffd700" : "#7ed957",
                    paddingTop: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 8,
                      fontWeight: 600,
                      color: index % 2 === 0 ? "#ffd700" : "#7ed957",
                      marginBottom: 5,
                    }}
                  >
                    {milestone.date}
                  </Text>
                  <Text
                    style={{ fontSize: 8, fontWeight: 600, marginBottom: 3 }}
                  >
                    {milestone.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 7.5,
                      lineHeight: 1.35,
                      color: "#e3e4e2",
                    }}
                  >
                    {milestone.description}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </DeckPage>
      )}
      {data.team.length > 0 && (
        <DeckPage dark accent={accent}>
          <Text style={s.display}>EQUIPO</Text>
          <Text style={[s.display, { color: accent }]}>PRINCIPAL.</Text>
          <View style={{ marginTop: "auto", flexDirection: "row", gap: 20 }}>
            {data.team.slice(0, 5).map((member) => (
              <View key={member.id} style={{ width: "18%" }}>
                {member.photoUrl ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image
                    src={pdfImageSource(member.photoUrl)}
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: 38,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: 38,
                      borderWidth: 1,
                      borderColor: "#fff",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{ fontSize: 20, fontFamily: "Helvetica-Bold" }}
                    >
                      {member.name
                        .split(" ")
                        .map((word) => word[0])
                        .slice(0, 2)
                        .join("")}
                    </Text>
                  </View>
                )}
                <Text
                  style={{
                    marginTop: 10,
                    fontSize: 10,
                    fontFamily: "Helvetica-Bold",
                  }}
                >
                  {member.name}
                </Text>
                <Text style={{ marginTop: 3, fontSize: 8, color: "#bdbdbd" }}>
                  {member.role}
                </Text>
              </View>
            ))}
          </View>
        </DeckPage>
      )}
      <DeckPage accent={accent}>
        <Text style={[s.display, { fontSize: 48 }]}>INVERSIÓN.</Text>
        <View
          style={{
            marginTop: "auto",
            flexDirection: "row",
            gap: 46,
            alignItems: "flex-end",
          }}
        >
          <View style={{ width: "55%" }}>
            <Text style={[s.eyebrow, { marginBottom: 8 }]}>
              Servicios considerados
            </Text>
            {data.services.slice(0, 10).map((service) => {
              const equivalent =
                service.currency === "UF"
                  ? `≈ ${formatMoney(service.amount * data.totals.ufClp, "CLP")}`
                  : service.currency === "CLP" && data.totals.ufClp > 0
                    ? `≈ ${formatMoney(service.amount / data.totals.ufClp, "UF")}`
                    : null;
              return (
                <View
                  key={service.id}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    borderTopWidth: 0.5,
                    borderTopColor: "#aaa",
                    paddingVertical: 5,
                  }}
                >
                  <View style={{ width: "66%" }}>
                    <Text style={{ fontSize: 8.5, fontWeight: 600 }}>
                      {service.name}
                    </Text>
                    <Text
                      style={{ marginTop: 2, fontSize: 6.5, color: "#777" }}
                    >
                      {service.cadence === "monthly"
                        ? "Mensual"
                        : service.cadence === "quarterly"
                          ? "Trimestral"
                          : "Valor único"}
                    </Text>
                  </View>
                  <View style={{ width: "34%", alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 8.5, fontWeight: 600 }}>
                      {formatMoney(service.amount, service.currency)}
                    </Text>
                    {equivalent && (
                      <Text
                        style={{ marginTop: 2, fontSize: 6.5, color: "#777" }}
                      >
                        {equivalent}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          <View style={{ width: "45%" }}>
            {data.totals.ufClp > 0 && (
              <PdfRow
                label="Neto equivalente"
                value={formatMoney(
                  data.totals.netClp / data.totals.ufClp,
                  "UF",
                )}
              />
            )}
            {data.totals.oneTimeUf > 0 && (
              <PdfRow
                label="Subtotal único UF"
                value={`${data.totals.oneTimeUf.toLocaleString("es-CL")} UF + IVA`}
              />
            )}
            {data.totals.monthlyUf > 0 && (
              <PdfRow
                label="Valor mensual"
                value={`${data.totals.monthlyUf.toLocaleString("es-CL")} UF + IVA`}
              />
            )}
            {data.totals.quarterlyUf > 0 && (
              <PdfRow
                label="Valor trimestral"
                value={`${data.totals.quarterlyUf.toLocaleString("es-CL")} UF + IVA`}
              />
            )}
            <PdfRow
              label="Neto referencial"
              value={formatMoney(data.totals.netClp, "CLP")}
            />
            <PdfRow
              label="IVA 19%"
              value={formatMoney(data.totals.ivaClp, "CLP")}
            />
            <PdfRow
              label="Total referencial"
              value={formatMoney(data.totals.totalClp, "CLP")}
            />
            <Text style={{ marginTop: 12, fontSize: 7 }}>
              UF usada: {formatMoney(data.totals.ufClp, "CLP")}. Cada servicio
              conserva su moneda original; la equivalencia se calcula con la UF
              vigente. Valores netos, IVA se suma al total.
            </Text>
          </View>
        </View>
      </DeckPage>
      {data.sections.commercialConditions && (
        <TextPage
          title="Condiciones"
          value={data.sections.commercialConditions}
          accent={accent}
        />
      )}
      {data.sections.exclusions && (
        <TextPage
          title="No considera"
          value={data.sections.exclusions}
          accent={accent}
        />
      )}
      {data.sections.nextSteps && (
        <TextPage
          title="Próximos pasos"
          value={data.sections.nextSteps}
          accent={accent}
        />
      )}
      <BankPdfPage accent={accent} />
      <OpeningClosingPage accent={accent} />
    </Document>
  );
}

function PdfRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

export async function renderProposalPdf(
  data: ProposalPdfData,
): Promise<Buffer> {
  return renderToBuffer(<ProposalPdf data={data} />);
}
