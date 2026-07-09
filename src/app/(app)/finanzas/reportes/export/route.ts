import ExcelJS from "exceljs";
import { requireFinance } from "@/lib/auth";
import {
  getResultadoOperacional,
  getFlujoCajaReal,
  getFlujoCajaProyectado,
  getPorContacto,
  getResultadoPorLinea,
} from "@/features/finance/queries";

export const runtime = "nodejs";

const MONEY = "#,##0";

export async function GET() {
  // Gateado por rol; lanza si no es Finanzas.
  await requireFinance();

  const [resultado, flujoReal, proyectado, ventas, compras, porLinea] =
    await Promise.all([
      getResultadoOperacional(),
      getFlujoCajaReal(12),
      getFlujoCajaProyectado(),
      getPorContacto("VENTA", 100),
      getPorContacto("COMPRA", 100),
      getResultadoPorLinea(),
    ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Noma · Studio Nomade";
  wb.created = new Date();

  // Resultado operacional
  const s1 = wb.addWorksheet("Resultado operacional");
  s1.columns = [
    { header: "Código", key: "code", width: 12 },
    { header: "Cuenta", key: "name", width: 40 },
    { header: "Tipo", key: "type", width: 14 },
    { header: "Neto", key: "neto", width: 16, style: { numFmt: MONEY } },
  ];
  resultado.rows.forEach((r) => s1.addRow(r));
  s1.addRow({});
  s1.addRow({ name: "Ingresos", neto: resultado.ingresos });
  s1.addRow({ name: "Egresos", neto: resultado.egresos });
  s1.addRow({ name: "Resultado", neto: resultado.resultado });

  // Flujo real
  const s2 = wb.addWorksheet("Flujo real");
  s2.columns = [
    { header: "Período", key: "periodo", width: 12 },
    { header: "Ingresos", key: "ingresos", width: 16, style: { numFmt: MONEY } },
    { header: "Egresos", key: "egresos", width: 16, style: { numFmt: MONEY } },
    { header: "Neto", key: "neto", width: 16, style: { numFmt: MONEY } },
  ];
  flujoReal.forEach((r) => s2.addRow(r));

  // Flujo proyectado
  const s3 = wb.addWorksheet("Flujo proyectado");
  s3.columns = [
    { header: "Período", key: "periodo", width: 12 },
    { header: "Por cobrar", key: "porCobrar", width: 16, style: { numFmt: MONEY } },
    { header: "Por pagar", key: "porPagar", width: 16, style: { numFmt: MONEY } },
    { header: "Neto", key: "neto", width: 16, style: { numFmt: MONEY } },
  ];
  proyectado.forEach((r) => s3.addRow(r));

  // Por contacto
  const s4 = wb.addWorksheet("Por contacto");
  s4.columns = [
    { header: "Dirección", key: "dir", width: 12 },
    { header: "Contacto", key: "name", width: 40 },
    { header: "RUT", key: "rut", width: 16 },
    { header: "Docs", key: "docs", width: 8 },
    { header: "Neto", key: "neto", width: 16, style: { numFmt: MONEY } },
  ];
  ventas.forEach((r) => s4.addRow({ dir: "VENTA", ...r }));
  compras.forEach((r) => s4.addRow({ dir: "COMPRA", ...r }));

  // Por línea
  const s5 = wb.addWorksheet("Por línea");
  s5.columns = [
    { header: "Línea", key: "linea", width: 30 },
    { header: "Ventas", key: "ventas", width: 16, style: { numFmt: MONEY } },
    { header: "Compras", key: "compras", width: 16, style: { numFmt: MONEY } },
    { header: "Resultado", key: "resultado", width: 16, style: { numFmt: MONEY } },
  ];
  porLinea.forEach((r) => s5.addRow(r));

  // Encabezados en negrita
  [s1, s2, s3, s4, s5].forEach((ws) => {
    ws.getRow(1).font = { bold: true };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `reportes-finanzas-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
