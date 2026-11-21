import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { AREA_THEME, BRAND } from "@/lib/brand/brand";
import type { Area } from "@/types/enums";

export type SlaPdfData = {
  title: string;
  clientName: string;
  projectName: string;
  sections: { label: string; body: string }[];
  signedByName?: string | null;
  signedAt?: string | null;
  /** Área principal: define el color de la banda y el rótulo del documento. */
  area?: Area | null;
};

const s = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    color: "#1d1d1b",
    fontFamily: "Helvetica",
  },
  band: { height: 6, marginBottom: 16, backgroundColor: "#1d1d1b" },
  kicker: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#6b7280",
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    marginBottom: 2,
  },
  meta: { fontSize: 10, color: "#6b7280", marginBottom: 18 },
  h2: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 3,
  },
  para: { lineHeight: 1.5 },
  sign: { marginTop: 28, borderTop: "1px solid #ecf0ee", paddingTop: 10 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#6b7280",
    borderTop: "1px solid #ecf0ee",
    paddingTop: 6,
  },
});

function SlaPdf({ data }: { data: SlaPdfData }) {
  const theme = data.area ? AREA_THEME[data.area] : null;
  return (
    <Document title={data.title} author={BRAND.name}>
      <Page size="A4" style={s.page}>
        <View
          style={[s.band, theme ? { backgroundColor: theme.accent } : {}]}
        />
        <Text style={s.kicker}>
          Acuerdo de Nivel de Servicio (SLA)
          {theme ? ` · ${theme.label}` : ""}
        </Text>
        <Text style={s.title}>{data.title}</Text>
        <Text style={s.meta}>
          {data.clientName} · {data.projectName}
        </Text>

        {data.sections.map((sec, i) => (
          <View key={i} wrap={false}>
            <Text style={s.h2}>{sec.label}</Text>
            <Text style={s.para}>{sec.body}</Text>
          </View>
        ))}

        <View style={s.sign}>
          {data.signedByName ? (
            <>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>
                {data.signedByName}
              </Text>
              <Text style={{ fontSize: 9, color: "#6b7280" }}>
                Representante Legal · {BRAND.name}
                {data.signedAt
                  ? ` · Firmado el ${new Date(data.signedAt).toLocaleDateString("es-CL")}`
                  : ""}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 9, color: "#6b7280" }}>
              Pendiente de firma del Representante Legal.
            </Text>
          )}
        </View>

        <Text style={s.footer} fixed>
          {BRAND.name} · {BRAND.email} · {BRAND.site} · {BRAND.phone}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderSlaPdf(data: SlaPdfData): Promise<Buffer> {
  return renderToBuffer(<SlaPdf data={data} />);
}
