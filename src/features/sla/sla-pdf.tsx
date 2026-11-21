import {
  Document,
  Font,
  Image,
  Link,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { AREA_THEME, BRAND } from "@/lib/brand/brand";
import { pdfAssetPath } from "@/features/proposals/templates/assets";
import type { Area } from "@/types/enums";

/**
 * PDF del SLA con el formato de los SLA del Studio (carta, cabecera con logo y
 * código, Montserrat para títulos, Poppins para texto, pie con ícono y casilla
 * del área y numeración [01]).
 */
export type SlaPdfData = {
  title: string;
  clientName: string;
  projectName: string;
  sections: { label: string; body: string }[];
  signedByName?: string | null;
  signedAt?: string | null;
  /** Área principal: ícono y casilla del pie. */
  area?: Area | null;
  /** Código de la propuesta, p. ej. A&D_N261121. */
  code?: string | null;
  /** Razón social y RUT del cliente para el bloque de firmas. */
  clientLegalName?: string | null;
  clientRut?: string | null;
  /** Fecha de última actualización del SLA (ISO). */
  updatedAt?: string | null;
};

Font.registerHyphenationCallback((word) => [word]);
Font.register({
  family: "Poppins",
  fonts: [
    { src: pdfAssetPath("/assets/fonts/poppins-light.ttf"), fontWeight: 300 },
    {
      src: pdfAssetPath("/assets/fonts/poppins-regular.ttf"),
      fontWeight: 400,
    },
  ],
});
Font.register({
  family: "Montserrat",
  fonts: [
    {
      src: pdfAssetPath("/assets/fonts/montserrat-semibold.ttf"),
      fontWeight: 600,
    },
    {
      src: pdfAssetPath("/assets/fonts/montserrat-bold.ttf"),
      fontWeight: 700,
    },
  ],
});

const INK = "#1d1d1b";
const GREY = "#9a9a9a";
const LEFT = 53;
const RIGHT = 106; // el contenido termina en x = 506 pt, como el SLA de Web

const s = StyleSheet.create({
  page: {
    paddingTop: 80,
    paddingBottom: 96,
    paddingLeft: LEFT,
    paddingRight: RIGHT,
    fontFamily: "Poppins",
    fontWeight: 300,
    fontSize: 8.5,
    color: INK,
  },
  header: {
    position: "absolute",
    top: 36,
    left: LEFT,
    right: RIGHT,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
    borderBottom: `0.75pt solid ${GREY}`,
  },
  lockup: { width: 88, height: 21 },
  headerText: { fontSize: 7.5, maxWidth: 330, textAlign: "right" },
  title: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 10.5,
    textAlign: "center",
    marginTop: 4,
  },
  subtitle: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 8.5,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  metaRow: { flexDirection: "row", marginBottom: 1.5 },
  metaLabel: { fontFamily: "Montserrat", fontWeight: 700, fontSize: 8.5 },
  metaValue: { fontSize: 8.5, flex: 1 },
  h2: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  line: { textAlign: "justify", marginBottom: 1.5 },
  subhead: {
    fontFamily: "Montserrat",
    fontWeight: 600,
    fontSize: 8.5,
    marginTop: 4,
    marginBottom: 3,
  },
  bulletRow: { flexDirection: "row", marginBottom: 2 },
  bulletMark: { width: 17, paddingLeft: 17 - 6 },
  bulletText: { flex: 1, paddingLeft: 11 },
  gap: { height: 8 },
  signs: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 90,
  },
  signBox: {
    width: 190,
    borderTop: `0.75pt solid ${INK}`,
    paddingTop: 6,
    alignItems: "center",
  },
  signName: { fontSize: 8.5, textAlign: "center" },
  signNote: { fontSize: 7.5, color: "#6b7280", marginTop: 10 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: LEFT,
    right: RIGHT,
    borderTop: `0.75pt solid ${GREY}`,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  footerIcon: { width: 30, height: 30, marginLeft: 10 },
  footerRight: { alignItems: "flex-end", paddingTop: 6 },
  footerMail: { fontSize: 7.5, color: "#1155cc", textDecoration: "underline" },
  footerPage: { fontSize: 7.5, marginTop: 1 },
});

type BodyLine = {
  kind: "text" | "bullet" | "subhead" | "gap";
  text: string;
};

/**
 * Divide el cuerpo de una sección en líneas para que el PDF pueda paginar
 * dentro de la sección (un solo bloque largo se cortaba al final de la hoja).
 * Subtítulos: numeración tipo "3.1." o líneas cortas que terminan en ":".
 */
export function bodyLines(body: string): BodyLine[] {
  const lines: BodyLine[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const text = raw.trimEnd();
    if (!text.trim()) {
      if (lines.length && lines.at(-1)!.kind !== "gap") {
        lines.push({ kind: "gap", text: "" });
      }
      continue;
    }
    const trimmed = text.trim();
    if (/^[•\-–]\s/.test(trimmed)) {
      lines.push({ kind: "bullet", text: trimmed.slice(2).trim() });
    } else if (
      (/^\d+\.\d+\.\s/.test(trimmed) && trimmed.length <= 90) ||
      (trimmed.endsWith(":") && trimmed.length <= 40)
    ) {
      lines.push({ kind: "subhead", text: trimmed });
    } else {
      lines.push({ kind: "text", text: trimmed });
    }
  }
  while (lines.at(-1)?.kind === "gap") lines.pop();
  return lines;
}

/** Agrupa cada subtítulo (y espacio previo) con la línea que le sigue. */
export function lineGroups(lines: BodyLine[]): BodyLine[][] {
  const groups: BodyLine[][] = [];
  let pending: BodyLine[] = [];
  for (const line of lines) {
    pending.push(line);
    if (line.kind === "gap" || line.kind === "subhead") continue;
    groups.push(pending);
    pending = [];
  }
  if (pending.length) groups.push(pending);
  return groups;
}

/** "Miércoles 13 de mayo de 2026" */
export function longDate(iso: string): string {
  const text = new Date(iso).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  });
  return text.charAt(0).toUpperCase() + text.slice(1).replace(",", "");
}

function renderLine(line: BodyLine, key: number) {
  if (line.kind === "gap") return <View key={key} style={s.gap} />;
  if (line.kind === "bullet") {
    return (
      <View key={key} style={s.bulletRow}>
        <Text style={s.bulletMark}>•</Text>
        <Text style={s.bulletText}>{line.text}</Text>
      </View>
    );
  }
  return (
    <Text key={key} style={line.kind === "subhead" ? s.subhead : s.line}>
      {line.text}
    </Text>
  );
}

function SignBlock({ data }: { data: SlaPdfData }) {
  return (
    <View wrap={false}>
      <View style={s.signs}>
        <View style={s.signBox}>
          <Text style={s.signName}>{BRAND.bank.razonSocial}</Text>
          <Text style={s.signName}>{BRAND.bank.rut}</Text>
        </View>
        <View style={s.signBox}>
          <Text style={s.signName}>
            {data.clientLegalName || data.clientName}
          </Text>
          {data.clientRut ? (
            <Text style={s.signName}>{data.clientRut}</Text>
          ) : null}
        </View>
      </View>
      <Text style={s.signNote}>
        {data.signedByName
          ? `Firmado por ${data.signedByName}, Representante Legal de ${BRAND.bank.razonSocial}${
              data.signedAt
                ? `, el ${new Date(data.signedAt).toLocaleDateString("es-CL")}`
                : ""
            }.`
          : "Pendiente de firma del Representante Legal."}
      </Text>
    </View>
  );
}

function SlaPdf({ data }: { data: SlaPdfData }) {
  const theme = data.area ? AREA_THEME[data.area] : null;
  const mail = theme?.email ?? BRAND.email;
  const headerText = [data.code, `${data.clientName} | ${data.title} – SLA`]
    .filter(Boolean)
    .join(" – ");

  return (
    <Document title={`${data.title} – SLA`} author={BRAND.bank.razonSocial}>
      <Page size="LETTER" style={s.page}>
        <View style={s.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf no usa alt */}
          <Image
            style={s.lockup}
            src={pdfAssetPath("/assets/brand/nomade-lockup.png")}
          />
          <Text style={s.headerText}>{headerText}</Text>
        </View>

        <Text style={s.title}>SERVICE LEVEL AGREEMENT (SLA)</Text>
        <Text style={s.subtitle}>
          {data.title} – {data.clientName}
        </Text>

        <View style={{ marginBottom: 4 }}>
          {[
            ["Proveedor:", BRAND.bank.razonSocial],
            ["Cliente:", data.clientLegalName || data.clientName],
            [
              "Vigencia:",
              "Desde la aceptación formal de la propuesta comercial hasta la entrega final del proyecto.",
            ],
            ...(data.updatedAt
              ? [["Última actualización:", longDate(data.updatedAt)]]
              : []),
          ].map(([label, value]) => (
            <View key={label} style={s.metaRow}>
              <Text style={s.metaValue}>
                <Text style={s.metaLabel}>{label}</Text> {value}
              </Text>
            </View>
          ))}
        </View>

        {data.sections.map((sec, i) => {
          const groups = lineGroups(bodyLines(sec.body));
          return (
            <View key={i}>
              {groups.map((group, g) => (
                // Grupos pequeños que no se parten: cada título queda con su
                // primera línea.
                <View key={g} wrap={false}>
                  {g === 0 && <Text style={s.h2}>{sec.label}</Text>}
                  {group.map((line, j) => renderLine(line, j))}
                </View>
              ))}
              {groups.length === 0 && <Text style={s.h2}>{sec.label}</Text>}
            </View>
          );
        })}

        <SignBlock data={data} />

        <View style={s.footer} fixed>
          {theme?.icon ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf no usa alt
            <Image style={s.footerIcon} src={pdfAssetPath(theme.icon)} />
          ) : (
            <View />
          )}
          <View style={s.footerRight}>
            <Link style={s.footerMail} src={`mailto:${mail}`}>
              {mail}
            </Link>
            <Text
              style={s.footerPage}
              render={({ pageNumber }) =>
                `[${String(pageNumber).padStart(2, "0")}]`
              }
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderSlaPdf(data: SlaPdfData): Promise<Buffer> {
  return renderToBuffer(<SlaPdf data={data} />);
}
