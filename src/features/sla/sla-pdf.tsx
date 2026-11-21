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
  line: { lineHeight: 1.4, marginBottom: 2 },
  bullet: { lineHeight: 1.4, marginBottom: 2, paddingLeft: 10 },
  subhead: {
    lineHeight: 1.4,
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
    marginBottom: 2,
  },
  gap: { height: 6 },
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
  // Helvetica (fuente base del PDF) no trae "²" ni "³".
  const clean = body.replace(/²/g, "2").replace(/³/g, "3");
  for (const raw of clean.split(/\r?\n/)) {
    const text = raw.trimEnd();
    if (!text.trim()) {
      if (lines.length && lines.at(-1)!.kind !== "gap") {
        lines.push({ kind: "gap", text: "" });
      }
      continue;
    }
    const trimmed = text.trim();
    if (/^[•\-–]\s/.test(trimmed)) {
      lines.push({ kind: "bullet", text: `• ${trimmed.slice(2).trim()}` });
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

function renderLine(line: BodyLine, key: number) {
  if (line.kind === "gap") return <View key={key} style={s.gap} />;
  const style =
    line.kind === "subhead"
      ? s.subhead
      : line.kind === "bullet"
        ? s.bullet
        : s.line;
  return (
    <Text key={key} style={style}>
      {line.text}
    </Text>
  );
}

function SignBlock({ data }: { data: SlaPdfData }) {
  return (
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
  );
}

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
        <Text style={s.title}>{data.title.replace(/²/g, "2")}</Text>
        <Text style={s.meta}>
          {data.clientName} · {data.projectName}
        </Text>

        {data.sections.map((sec, i) => {
          const groups = lineGroups(bodyLines(sec.body));
          const last = i === data.sections.length - 1;
          return (
            <View key={i}>
              {groups.map((group, g) => (
                // Grupos pequeños que no se parten: un título queda con su
                // primera línea y la firma con la última línea del documento.
                <View key={g} wrap={false}>
                  {g === 0 && <Text style={s.h2}>{sec.label}</Text>}
                  {group.map((line, j) => renderLine(line, j))}
                  {last && g === groups.length - 1 && <SignBlock data={data} />}
                </View>
              ))}
              {groups.length === 0 && (
                <View wrap={false}>
                  <Text style={s.h2}>{sec.label}</Text>
                  {last && <SignBlock data={data} />}
                </View>
              )}
            </View>
          );
        })}
        {data.sections.length === 0 && <SignBlock data={data} />}

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
