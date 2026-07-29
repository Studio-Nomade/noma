import { requireFinance } from "@/lib/auth";
import { buildSalesOrderPdfData } from "@/features/finance/sales-orders/build-pdf-data";
import { renderSalesOrderPdf } from "@/features/finance/sales-orders/sales-order-pdf";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireFinance();
  const { id } = await params;
  const bundle = await buildSalesOrderPdfData(id);
  if (!bundle) return new Response("No encontrado", { status: 404 });
  const pdf = await renderSalesOrderPdf(bundle.data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(bundle.filename)}"`,
    },
  });
}
