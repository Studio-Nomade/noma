import "server-only";

import type { Currency } from "@/types/enums";
import {
  getSalesOrder,
  getSalesOrderLines,
} from "./queries";
import type { SalesOrderPdfData } from "./sales-order-pdf";

export async function buildSalesOrderPdfData(id: string): Promise<{
  data: SalesOrderPdfData;
  filename: string;
} | null> {
  const [row, lines] = await Promise.all([
    getSalesOrder(id),
    getSalesOrderLines(id),
  ]);
  if (!row) return null;
  const { order, client } = row;
  return {
    filename: `${order.folio} - ${client.companyName}.pdf`,
    data: {
      folio: order.folio,
      emissionDate: order.emissionDate,
      dueDate: order.dueDate,
      client: {
        name: client.companyName,
        legalName: client.legalName,
        rut: client.rut,
        address: client.taxAddress,
      },
      projectName: row.projectName,
      lines: lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        price: Number(line.priceAmount),
        currency: line.currency as Currency,
        discount: Number(line.discountAmount),
        total: Number(line.totalAmount),
      })),
      subtotal: Number(order.subtotalAmount),
      iva: Number(order.ivaAmount),
      total: Number(order.totalAmount),
      currency: order.currency as Currency,
      notes: order.notes,
    },
  };
}
