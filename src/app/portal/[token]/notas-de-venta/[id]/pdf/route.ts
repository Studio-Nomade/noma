import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, salesOrders } from "@/db/schema";
import { buildSalesOrderPdfData } from "@/features/finance/sales-orders/build-pdf-data";
import { renderSalesOrderPdf } from "@/features/finance/sales-orders/sales-order-pdf";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;
  const [authorized] = await db
    .select({ id: salesOrders.id })
    .from(salesOrders)
    .innerJoin(clients, eq(salesOrders.clientId, clients.id))
    .where(and(eq(clients.portalToken, token), eq(salesOrders.id, id)))
    .limit(1);
  if (!authorized) {
    return new Response("No encontrado", { status: 404 });
  }
  const bundle = await buildSalesOrderPdfData(id);
  if (!bundle) return new Response("No encontrado", { status: 404 });
  const pdf = await renderSalesOrderPdf(bundle.data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(bundle.filename)}"`,
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
