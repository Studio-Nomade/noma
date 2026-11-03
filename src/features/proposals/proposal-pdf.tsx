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
import { equivalences } from "@/lib/currency/convert";
import { proposalAreaAccent, proposalTheme } from "./templates/themes";
import type { ProposalTemplateData } from "./templates/types";
import { getAreaCover, getHeaderLogo, pdfAssetPath } from "./templates/assets";
import type { Area } from "@/types/enums";
import type { StructuredContentItem } from "./structured-content";
import type { RichTextBlock } from "@/features/services/rich-text";
import {
  paginateColumns,
  paginateTextBlocks,
  parseProposalText,
  textBlocksWeight,
  type TextBlock,
} from "./templates/text-layout";

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
      <View style={s.body} wrap={false}>
        {children}
      </View>
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
    { label: "Audiovisual", icon: "/assets/areas/aa-badge.png" },
    { label: "Arquitectura", icon: "/assets/areas/ad-badge.png" },
    { label: "Web Design", icon: "/assets/areas/wd-badge.png" },
    { label: "Branding", icon: "/assets/areas/bd-badge.png" },
  ];

  return (
    <DeckPage dark accent={accent}>
      <View style={[s.grid, { gap: 60 }]}>
        <View style={{ width: "40%", color: proposalTheme.paper }}>
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
        <View style={{ width: "60%" }}>
          <Text style={s.eyebrow}>Studio Nomade</Text>
          <Text style={[s.display, { fontSize: 28, lineHeight: 1 }]}>
            INFORMACIÓN BANCARIA.
          </Text>
          <View
            style={{
              marginTop: 18,
              flexDirection: "row",
              flexWrap: "wrap",
            }}
          >
            {studioAreas.map((area) => (
              <View
                key={area.label}
                style={{ width: "50%", height: 136, alignItems: "center" }}
              >
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image
                  src={pdfAssetPath(area.icon)}
                  style={{ width: 128, height: 128, objectFit: "contain" }}
                />
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

function PdfTextRuns({ runs }: { runs: TextBlock["runs"] }) {
  return (
    <>
      {runs.map((run, index) => (
        <Text
          key={index}
          style={run.bold ? { fontFamily: "San Diego", fontWeight: 600 } : {}}
        >
          {run.text}
        </Text>
      ))}
    </>
  );
}

/**
 * Bloques de texto con jerarquía: subtítulos en el color del área, párrafos
 * con aire entre sí y viñetas. `tone` ajusta los grises según el fondo.
 */
function PdfTextBlocks({
  blocks,
  accent,
  tone = "light",
  size = 12,
}: {
  blocks: TextBlock[];
  accent: string;
  tone?: "light" | "dark";
  size?: number;
}) {
  const muted = tone === "dark" ? "#d6d6d3" : "#3d3d3b";
  return (
    <View>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <Text
              key={index}
              style={{
                marginTop: index ? size * 0.9 : 0,
                marginBottom: size * 0.35,
                fontSize: size * 0.92,
                lineHeight: 1.3,
                fontWeight: 600,
                color: accent,
                letterSpacing: 0.2,
                textTransform: "uppercase",
              }}
            >
              <PdfTextRuns runs={block.runs} />
            </Text>
          );
        }
        if (block.kind === "bullet") {
          return (
            <View
              key={index}
              style={{ flexDirection: "row", marginTop: size * 0.3 }}
            >
              <Text style={{ width: 14, fontSize: size, color: accent }}>
                •
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: size,
                  lineHeight: 1.45,
                  color: muted,
                }}
              >
                <PdfTextRuns runs={block.runs} />
              </Text>
            </View>
          );
        }
        return (
          <Text
            key={index}
            style={{
              marginTop: index ? size * 0.55 : 0,
              fontSize: size,
              lineHeight: 1.5,
              color: muted,
            }}
          >
            <PdfTextRuns runs={block.runs} />
          </Text>
        );
      })}
    </View>
  );
}

/**
 * Lámina de texto libre (contexto, objetivo, alcance, condiciones…). Si el
 * texto no cabe, continúa en láminas siguientes manteniendo el título al
 * costado y un indicador 01 / 02.
 */
function TextPages({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: string;
}) {
  const blocks = parseProposalText(value);
  const pages = paginateTextBlocks(
    blocks,
    TEXT_PAGE_LINES,
    TEXT_CHARS_PER_LINE,
  );
  return (
    <>
      {pages.map((pageBlocks, index) => (
        <DeckPage key={`${title}-${index}`} accent={accent}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Text style={[s.eyebrow, { color: accent }]}>{title}</Text>
            {pages.length > 1 && (
              <Text style={{ fontSize: 7, color: "#8f8f8c" }}>
                {String(index + 1).padStart(2, "0")} /{" "}
                {String(pages.length).padStart(2, "0")}
              </Text>
            )}
          </View>
          <View style={s.grid}>
            <Text style={[s.display, s.half, { fontSize: titleSize(title) }]}>
              {title}
            </Text>
            <View style={s.half}>
              <PdfTextBlocks blocks={pageBlocks} accent={accent} />
            </View>
          </View>
        </DeckPage>
      ))}
    </>
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

function PdfRichTextRuns({ block }: { block: RichTextBlock }) {
  return (
    <>
      {block.runs.map((run, index) => (
        <Text
          key={index}
          style={run.bold ? { fontFamily: "San Diego", fontWeight: 600 } : {}}
        >
          {run.text}
        </Text>
      ))}
    </>
  );
}

/** Lámina de texto: líneas disponibles y caracteres por línea (12 pt, media lámina). */
const TEXT_PAGE_LINES = 19;
const TEXT_CHARS_PER_LINE = 64;
/** Metodología/entregables a 3 columnas (9.6 pt): líneas por columna y ancho. */
const RICH_COLUMN_LINES = 16;
const RICH_CHARS_PER_LINE = 50;
/** Lámina combinada (2 columnas a 11 pt): si cada bloque cabe, van juntos. */
const COMBINED_COLUMN_LINES = 16;
const COMBINED_CHARS_PER_LINE = 68;

function PdfRichTextColumn({
  blocks,
  accent,
  size = 9.6,
}: {
  blocks: RichTextBlock[];
  accent: string;
  size?: number;
}) {
  return (
    <View>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <Text
              key={index}
              style={{
                marginTop: index ? size * 0.9 : 0,
                marginBottom: size * 0.4,
                fontSize: size * 1.08,
                lineHeight: 1.3,
                color: accent,
                fontWeight: 600,
              }}
            >
              <PdfRichTextRuns block={block} />
            </Text>
          );
        }
        const listPrefix =
          block.kind === "ordered"
            ? `${block.ordinal}.`
            : block.kind === "bullet"
              ? "•"
              : "";
        return (
          <View
            key={index}
            style={{
              flexDirection: "row",
              marginTop: index ? size * 0.55 : 0,
              paddingLeft: block.level * 8,
            }}
          >
            {listPrefix && (
              <Text
                style={{
                  width: size * 1.7,
                  fontSize: size,
                  fontWeight: 600,
                  color: accent,
                }}
              >
                {listPrefix}
              </Text>
            )}
            <Text
              style={{
                flex: 1,
                fontSize: size,
                lineHeight: 1.45,
                color: block.kind === "paragraph" ? "#d0d0cd" : "#f5f5f3",
              }}
            >
              <PdfRichTextRuns block={block} />
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ServiceRichTextPdfPage({
  serviceName,
  title,
  columns,
  accent,
  area,
  page,
  totalPages,
}: {
  serviceName: string;
  title: string;
  columns: RichTextBlock[][];
  accent: string;
  area: Area;
  page: number;
  totalPages: number;
}) {
  return (
    <DeckPage dark accent={accent} area={area}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text style={s.eyebrow}>{serviceName}</Text>
          <Text style={[s.display, { fontSize: titleSize(title, 38) }]}>
            {title}.
          </Text>
        </View>
        {totalPages > 1 && (
          <Text style={{ fontSize: 7, color: "#8f8f8c" }}>
            {String(page).padStart(2, "0")} /{" "}
            {String(totalPages).padStart(2, "0")}
          </Text>
        )}
      </View>
      <View
        style={{
          marginTop: 22,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        {columns.map((blocks, columnIndex) => (
          <View
            key={columnIndex}
            style={{
              width: "32%",
              paddingLeft: columnIndex ? 13 : 0,
              borderLeftWidth: columnIndex ? 0.5 : 0,
              borderLeftColor: "#4a4a48",
            }}
          >
            <PdfRichTextColumn blocks={blocks} accent={accent} size={10.5} />
          </View>
        ))}
      </View>
    </DeckPage>
  );
}

/** Proceso e incluye en una misma lámina, cada uno en su columna. */
function ServiceProcessPdfPage({
  serviceName,
  methodology,
  deliverables,
  accent,
  area,
}: {
  serviceName: string;
  methodology: RichTextBlock[];
  deliverables: RichTextBlock[];
  accent: string;
  area: Area;
}) {
  const columns = [
    { title: "Proceso / metodología", blocks: methodology },
    { title: "Incluye", blocks: deliverables },
  ];
  return (
    <DeckPage dark accent={accent} area={area}>
      <Text style={s.eyebrow}>{serviceName}</Text>
      <Text style={[s.display, { fontSize: 34 }]}>CÓMO LO HACEMOS.</Text>
      <View
        style={{
          marginTop: 22,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 28,
        }}
      >
        {columns.map((column, index) => (
          <View
            key={column.title}
            style={{
              width: "50%",
              paddingLeft: index ? 24 : 0,
              borderLeftWidth: index ? 0.5 : 0,
              borderLeftColor: "#4a4a48",
            }}
          >
            <Text
              style={{
                marginBottom: 12,
                fontSize: 8,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: accent,
              }}
            >
              {column.title}
            </Text>
            <PdfRichTextColumn
              blocks={column.blocks}
              accent={accent}
              size={11}
            />
          </View>
        ))}
      </View>
    </DeckPage>
  );
}

const EXECUTION_COPY: Record<string, { title: string; body: string }> = {
  Prioridad: {
    title: "MODALIDAD PRIORITARIA",
    body: "Aplicable a proyectos que requieren agilizar su ejecución. Studio Nomade reorganiza parcialmente la planificación y asigna atención preferente, sin comprometer jornadas extraordinarias de manera significativa.",
  },
  "Contra Reloj": {
    title: "MODALIDAD CONTRA RELOJ",
    body: "Para proyectos con una reducción importante de los tiempos habituales. Considera dedicación preferente, alta disponibilidad del equipo y, cuando sea necesario, ejecución fuera del horario laboral para cumplir una fecha inamovible.",
  },
  Crítico: {
    title: "MODALIDAD CRÍTICA",
    body: "Para fechas inamovibles o situaciones de alta criticidad operacional. El equipo prioriza completamente el proyecto y puede ejecutar jornadas intensivas nocturnas, fines de semana o festivos.",
  },
};

function ExecutionModePdfPage({ priority }: { priority: string }) {
  const content = EXECUTION_COPY[priority];
  if (!content) return null;
  return (
    <DeckPage dark accent={proposalTheme.orange}>
      <View style={s.grid}>
        <Text
          style={[
            s.display,
            s.half,
            { fontSize: titleSize(content.title, 42) },
          ]}
        >
          {content.title}
        </Text>
        <View style={s.half}>
          <Text style={s.copy}>{content.body}</Text>
          <Text
            style={{
              marginTop: 24,
              fontSize: 11,
              lineHeight: 1.45,
              color: proposalTheme.orange,
            }}
          >
            El recargo modifica la prioridad y velocidad de ejecución, no el
            alcance contratado.
          </Text>
        </View>
      </View>
    </DeckPage>
  );
}

function MonthlyFeePdfPage() {
  return (
    <DeckPage dark accent={proposalTheme.orange}>
      <View style={s.grid}>
        <Text style={[s.display, s.half, { fontSize: 37 }]}>
          CONDICIÓN COMERCIAL PARA CLIENTES CON FEE
        </Text>
        <View style={s.half}>
          <Text style={s.copy}>
            Si el servicio base está contemplado en el fee mensual vigente, no
            se cobra nuevamente.
          </Text>
          <Text style={[s.copy, { marginTop: 18 }]}>
            Cuando la solicitud exige una ejecución acelerada, se aplica
            únicamente el recargo de Prioridad, Contra Reloj o Crítico definido
            para la propuesta.
          </Text>
          <Text style={[s.copy, { marginTop: 18 }]}>
            El recargo cubre la reorganización operativa y la asignación
            preferente de recursos, sin modificar el alcance original.
          </Text>
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
          <TextPages key={title} title={title} value={value!} accent={accent} />
        ))}
      <DeckPage accent={accent}>
        <Text style={[s.eyebrow, { color: accent }]}>
          Resumen de la propuesta
        </Text>
        <View style={[s.grid, { alignItems: "center" }]}>
          <Text style={[s.display, { width: "34%", fontSize: 50 }]}>
            QUÉ{"\n"}HAREMOS.
          </Text>
          <View
            style={{
              width: "66%",
              flexDirection: "row",
              flexWrap: "wrap",
            }}
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
                <Text style={{ width: 28, color: accent, fontSize: 11 }}>
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <Text style={{ flex: 1, fontSize: 11, lineHeight: 1.35 }}>
                  {service.name}
                </Text>
              </View>
            ))}
          </View>
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
          ...areaServices.flatMap((service) => {
            const serviceSlides: React.ReactNode[] = [
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
                        {
                          fontSize: titleSize(service.name, 43),
                          color: "#fff",
                        },
                      ]}
                    >
                      {service.name}
                    </Text>
                  </View>
                  <View style={s.half}>
                    <PdfTextBlocks
                      blocks={parseProposalText(
                        service.description ??
                          "Servicio seleccionado para esta propuesta.",
                        { maxParagraphChars: 180 },
                      )}
                      accent={proposalAreaAccent[service.area]}
                      tone="dark"
                      size={11.5}
                    />
                  </View>
                </View>
              </DeckPage>,
            ];
            const methodologyWeight = textBlocksWeight(
              service.methodology,
              COMBINED_CHARS_PER_LINE,
            );
            const deliverablesWeight = textBlocksWeight(
              service.deliverables,
              COMBINED_CHARS_PER_LINE,
            );
            const canCombine =
              service.methodology.length > 0 &&
              service.deliverables.length > 0 &&
              methodologyWeight <= COMBINED_COLUMN_LINES &&
              deliverablesWeight <= COMBINED_COLUMN_LINES;
            if (canCombine) {
              serviceSlides.push(
                <ServiceProcessPdfPage
                  key={`${service.id}-process`}
                  serviceName={service.name}
                  methodology={service.methodology}
                  deliverables={service.deliverables}
                  accent={proposalAreaAccent[service.area]}
                  area={service.area}
                />,
              );
            } else {
              const methodologyPages = paginateColumns(
                service.methodology,
                3,
                RICH_COLUMN_LINES,
                RICH_CHARS_PER_LINE,
              );
              serviceSlides.push(
                ...methodologyPages.map((columns, index) => (
                  <ServiceRichTextPdfPage
                    key={`${service.id}-methodology-${index}`}
                    serviceName={service.name}
                    title="Proceso / metodología"
                    columns={columns}
                    accent={proposalAreaAccent[service.area]}
                    area={service.area}
                    page={index + 1}
                    totalPages={methodologyPages.length}
                  />
                )),
              );
              const deliverablePages = paginateColumns(
                service.deliverables,
                3,
                RICH_COLUMN_LINES,
                RICH_CHARS_PER_LINE,
              );
              serviceSlides.push(
                ...deliverablePages.map((columns, index) => (
                  <ServiceRichTextPdfPage
                    key={`${service.id}-deliverables-${index}`}
                    serviceName={service.name}
                    title="Incluye"
                    columns={columns}
                    accent={proposalAreaAccent[service.area]}
                    area={service.area}
                    page={index + 1}
                    totalPages={deliverablePages.length}
                  />
                )),
              );
            }
            if (service.exclusions.length > 0) {
              serviceSlides.push(
                <DeckPage
                  key={`${service.id}-exclusions`}
                  dark
                  accent={proposalAreaAccent[service.area]}
                  area={service.area}
                >
                  <Text style={s.eyebrow}>{service.name}</Text>
                  <Text style={[s.display, { fontSize: 52 }]}>NO INCLUYE.</Text>
                  <View
                    style={{
                      marginTop: 28,
                      flexDirection: "row",
                      flexWrap: "wrap",
                    }}
                  >
                    {service.exclusions.slice(0, 10).map((item) => (
                      <View
                        key={`${item.title}-${item.description}`}
                        style={{
                          width: "50%",
                          borderTopWidth: 0.5,
                          borderTopColor: "#777",
                          paddingVertical: 11,
                          paddingRight: 24,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11.5,
                            lineHeight: 1.35,
                            fontWeight: 600,
                          }}
                        >
                          {item.title}
                        </Text>
                        {item.description && (
                          <Text
                            style={{
                              marginTop: 3,
                              fontSize: 9.5,
                              lineHeight: 1.4,
                              color: "#bdbdbd",
                            }}
                          >
                            {item.description}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </DeckPage>,
              );
            }
            return serviceSlides;
          }),
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
      {[...new Set(data.services.map((service) => service.priority))]
        .filter((priority) => priority !== "Normal")
        .map((priority) => (
          <ExecutionModePdfPage key={priority} priority={priority} />
        ))}
      {data.sections.includeMonthlyFeeCondition && <MonthlyFeePdfPage />}
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
        <Text style={[s.display, { fontSize: 48 }]}>TOTALES.</Text>
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
            <View
              style={{
                flexDirection: "row",
                borderTopWidth: 0.5,
                borderBottomWidth: 0.5,
                borderColor: "#aaa",
                paddingVertical: 5,
              }}
            >
              <Text style={{ width: "40%", fontSize: 6.5 }}>SERVICIO</Text>
              <Text style={{ width: "22%", fontSize: 6.5, textAlign: "right" }}>
                VALOR UNITARIO
              </Text>
              <Text
                style={{ width: "12%", fontSize: 6.5, textAlign: "center" }}
              >
                CANT.
              </Text>
              <Text style={{ width: "26%", fontSize: 6.5, textAlign: "right" }}>
                TOTAL
              </Text>
            </View>
            {data.services.slice(0, 10).map((service) => {
              const rates = {
                ufClp: data.totals.ufClp,
                usdClp: data.totals.usdClp,
              };
              return (
                <View
                  key={service.id}
                  style={{
                    flexDirection: "row",
                    borderBottomWidth: 0.5,
                    borderTopColor: "#aaa",
                    paddingVertical: 6,
                  }}
                >
                  <View style={{ width: "40%" }}>
                    <Text style={{ fontSize: 8.5, fontWeight: 600 }}>
                      {service.name}
                    </Text>
                    {service.surcharge > 0 && (
                      <Text
                        style={{
                          marginTop: 3,
                          fontSize: 6.5,
                          color: proposalTheme.orange,
                        }}
                      >
                        {service.priority.toUpperCase()} (+
                        {service.surcharge * 100}%):{" "}
                        {formatMoney(service.surchargeAmount, service.currency)}
                      </Text>
                    )}
                  </View>
                  <View style={{ width: "22%", alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 8.5, fontWeight: 600 }}>
                      {formatMoney(service.unitAmount, service.currency)}
                    </Text>
                    <Text
                      style={{ marginTop: 2, fontSize: 5.5, color: "#777" }}
                    >
                      {equivalences(
                        service.unitAmount,
                        service.currency,
                        rates,
                      )}
                    </Text>
                  </View>
                  <Text
                    style={{
                      width: "12%",
                      fontSize: 8.5,
                      fontWeight: 600,
                      textAlign: "center",
                    }}
                  >
                    {service.quantity}
                  </Text>
                  <View style={{ width: "26%", alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 8.5, fontWeight: 600 }}>
                      {formatMoney(service.amount, service.currency)}
                    </Text>
                    <Text
                      style={{ marginTop: 2, fontSize: 5.5, color: "#777" }}
                    >
                      {equivalences(service.amount, service.currency, rates)}
                    </Text>
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
                  data.totals.baseNetClp / data.totals.ufClp,
                  "UF",
                )}
              />
            )}
            {data.totals.surchargeClp > 0 && data.totals.ufClp > 0 && (
              <PdfRow
                label="Recargo total"
                value={formatMoney(
                  data.totals.surchargeClp / data.totals.ufClp,
                  "UF",
                )}
              />
            )}
            <PdfRow
              label="Subtotal neto"
              value={formatMoney(
                data.totals.ufClp > 0
                  ? data.totals.netClp / data.totals.ufClp
                  : 0,
                "UF",
              )}
            />
            {data.totals.discountClp > 0 && (
              <PdfRow
                label={data.totals.discountLabel || "Descuento"}
                value={`− ${formatMoney(data.totals.discountClp, "CLP")}`}
              />
            )}
            <PdfRow
              label="IVA 19%"
              value={formatMoney(data.totals.ivaClp, "CLP")}
            />
            <PdfRow
              label="Total proyecto"
              value={formatMoney(
                data.totals.ufClp > 0
                  ? data.totals.totalClp / data.totals.ufClp
                  : 0,
                "UF",
              )}
            />
            <Text
              style={{
                marginTop: 6,
                fontSize: 8,
                fontFamily: "Helvetica-Bold",
                textAlign: "right",
              }}
            >
              {formatMoney(data.totals.totalClp, "CLP")} ·{" "}
              {formatMoney(
                data.totals.usdClp > 0
                  ? data.totals.totalClp / data.totals.usdClp
                  : 0,
                "USD",
              )}
            </Text>
            <Text style={{ marginTop: 12, fontSize: 7 }}>
              UF usada: {formatMoney(data.totals.ufClp, "CLP")} · USD observado:{" "}
              {formatMoney(data.totals.usdClp, "CLP")}. Valores netos, IVA se
              suma al total.
            </Text>
          </View>
        </View>
      </DeckPage>
      {data.sections.commercialConditions && (
        <TextPages
          title="Condiciones"
          value={data.sections.commercialConditions}
          accent={accent}
        />
      )}
      {data.sections.exclusions && (
        <TextPages
          title="No considera"
          value={data.sections.exclusions}
          accent={accent}
        />
      )}
      {data.sections.nextSteps && (
        <TextPages
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
