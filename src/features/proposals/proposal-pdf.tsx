import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { BRAND } from "@/lib/brand/brand";

export type ProposalPdfData = {
  title: string;
  clientName: string;
  projectName: string;
  areaLabel: string;
  accent: string;
  date: string;
  version: number;
  services: { name: string; subarea: string | null; value: string }[];
  totals: { subtotalUf: string; net: string; iva: string; total: string };
  team: { name: string; role: string }[];
  sections: { label: string; value: string }[];
};

const s = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    color: "#1d1d1b",
    fontFamily: "Helvetica",
  },
  band: { height: 6, marginBottom: 18 },
  area: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: { fontSize: 24, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  meta: { fontSize: 10, color: "#6b7280", marginBottom: 20 },
  h2: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottom: "1px solid #ecf0ee",
  },
  svcName: { fontFamily: "Helvetica-Bold" },
  svcSub: { fontSize: 8, color: "#6b7280" },
  totalsBox: { marginTop: 8, width: 240, alignSelf: "flex-end" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalStrong: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  para: { lineHeight: 1.5, color: "#1d1d1b" },
  teamItem: { width: "33%", marginBottom: 8 },
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

function ProposalPdf({ data }: { data: ProposalPdfData }) {
  return (
    <Document title={data.title} author={BRAND.name}>
      <Page size="A4" style={s.page}>
        <View style={[s.band, { backgroundColor: data.accent }]} />
        <Text style={[s.area, { color: data.accent }]}>{data.areaLabel}</Text>
        <Text style={s.title}>{data.title}</Text>
        <Text style={s.meta}>
          {data.clientName} · {data.projectName} · {data.date} · v{data.version}
        </Text>

        {data.services.length > 0 && (
          <View>
            <Text style={s.h2}>Servicios incluidos</Text>
            {data.services.map((sv, i) => (
              <View key={i} style={s.row}>
                <View>
                  <Text style={s.svcName}>{sv.name}</Text>
                  {sv.subarea ? (
                    <Text style={s.svcSub}>{sv.subarea}</Text>
                  ) : null}
                </View>
                <Text>{sv.value}</Text>
              </View>
            ))}
            <View style={s.totalsBox}>
              <View style={s.totalRow}>
                <Text>Subtotal</Text>
                <Text>{data.totals.subtotalUf}</Text>
              </View>
              <View style={s.totalRow}>
                <Text>Neto</Text>
                <Text>{data.totals.net}</Text>
              </View>
              <View style={s.totalRow}>
                <Text>IVA 19%</Text>
                <Text>{data.totals.iva}</Text>
              </View>
              <View
                style={[
                  s.totalRow,
                  {
                    borderTop: "1px solid #ecf0ee",
                    marginTop: 2,
                    paddingTop: 2,
                  },
                ]}
              >
                <Text style={s.totalStrong}>Total</Text>
                <Text style={s.totalStrong}>{data.totals.total}</Text>
              </View>
            </View>
          </View>
        )}

        {data.team.length > 0 && (
          <View>
            <Text style={s.h2}>Equipo principal</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {data.team.map((m, i) => (
                <View key={i} style={s.teamItem}>
                  <Text style={s.svcName}>{m.name}</Text>
                  <Text style={s.svcSub}>{m.role}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {data.sections.map((sec, i) => (
          <View key={i} wrap={false}>
            <Text style={s.h2}>{sec.label}</Text>
            <Text style={s.para}>{sec.value}</Text>
          </View>
        ))}

        <Text style={s.footer} fixed>
          {BRAND.name} · {BRAND.email} · {BRAND.site} · {BRAND.phone}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderProposalPdf(
  data: ProposalPdfData,
): Promise<Buffer> {
  return renderToBuffer(<ProposalPdf data={data} />);
}
