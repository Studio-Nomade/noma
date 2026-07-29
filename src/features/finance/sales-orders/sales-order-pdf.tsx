import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatMoney } from "@/lib/currency/format";
import type { Currency } from "@/types/enums";

export type SalesOrderPdfData = {
  folio: string;
  emissionDate: string;
  dueDate: string | null;
  client: {
    name: string;
    legalName: string | null;
    rut: string | null;
    address: string | null;
  };
  projectName: string;
  lines: {
    description: string;
    quantity: number;
    price: number;
    currency: Currency;
    discount: number;
    total: number;
  }[];
  subtotal: number;
  iva: number;
  total: number;
  currency: Currency;
  notes: string | null;
};

const styles = StyleSheet.create({
  page: {
    padding: 44,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1d1d1b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 34,
  },
  brand: { fontSize: 12, fontWeight: 700, letterSpacing: 1.5 },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 6 },
  muted: { color: "#666666", lineHeight: 1.45 },
  panel: {
    backgroundColor: "#ecf0ee",
    padding: 14,
    marginBottom: 22,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingBottom: 7,
    fontWeight: 700,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#cccccc",
    paddingVertical: 9,
  },
  product: { width: "43%" },
  qty: { width: "9%", textAlign: "right" },
  price: { width: "17%", textAlign: "right" },
  currency: { width: "9%", textAlign: "right" },
  discount: { width: "9%", textAlign: "right" },
  total: { width: "13%", textAlign: "right" },
  totals: { width: "42%", marginLeft: "58%", marginTop: 22 },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 8,
    fontSize: 12,
    fontWeight: 700,
  },
  notes: { marginTop: 24, lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#666666",
    fontSize: 7,
  },
});

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-CL");
}

export function SalesOrderPdf({ data }: { data: SalesOrderPdfData }) {
  return (
    <Document title={`Nota de Venta ${data.folio}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>STUDIO NOMADE</Text>
          <View>
            <Text style={styles.title}>NOTA DE VENTA</Text>
            <Text style={styles.muted}>{data.folio}</Text>
          </View>
        </View>
        <View style={styles.panel}>
          <View>
            <Text>{data.client.legalName || data.client.name}</Text>
            <Text style={styles.muted}>RUT {data.client.rut || "—"}</Text>
            <Text style={styles.muted}>{data.client.address || "—"}</Text>
          </View>
          <View>
            <Text>Emisión: {dateLabel(data.emissionDate)}</Text>
            <Text>Vencimiento: {dateLabel(data.dueDate)}</Text>
            <Text style={styles.muted}>Proyecto: {data.projectName}</Text>
          </View>
        </View>
        <View style={styles.tableHeader}>
          <Text style={styles.product}>Producto / servicio</Text>
          <Text style={styles.qty}>Cant.</Text>
          <Text style={styles.price}>Precio</Text>
          <Text style={styles.currency}>Moneda</Text>
          <Text style={styles.discount}>Dcto.</Text>
          <Text style={styles.total}>Total</Text>
        </View>
        {data.lines.map((line, index) => (
          <View style={styles.row} key={`${line.description}-${index}`}>
            <Text style={styles.product}>{line.description}</Text>
            <Text style={styles.qty}>{line.quantity}</Text>
            <Text style={styles.price}>
              {formatMoney(line.price, line.currency)}
            </Text>
            <Text style={styles.currency}>{line.currency}</Text>
            <Text style={styles.discount}>
              {formatMoney(line.discount, line.currency)}
            </Text>
            <Text style={styles.total}>
              {formatMoney(line.total, line.currency)}
            </Text>
          </View>
        ))}
        <View style={styles.totals}>
          <View style={styles.totalLine}>
            <Text>Subtotal</Text>
            <Text>{formatMoney(data.subtotal, data.currency)}</Text>
          </View>
          <View style={styles.totalLine}>
            <Text>IVA 19%</Text>
            <Text>{formatMoney(data.iva, data.currency)}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text>Total</Text>
            <Text>{formatMoney(data.total, data.currency)}</Text>
          </View>
        </View>
        {data.notes ? (
          <Text style={styles.notes}>Condiciones: {data.notes}</Text>
        ) : null}
        <View style={styles.footer}>
          <Text>contact@studionomade.cl · www.studionomade.cl</Text>
          <Text>STUDIO NOMADE®</Text>
        </View>
      </Page>
    </Document>
  );
}

export function renderSalesOrderPdf(data: SalesOrderPdfData) {
  return renderToBuffer(<SalesOrderPdf data={data} />);
}
