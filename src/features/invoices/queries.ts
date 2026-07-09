import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";

export async function getInvoiceByProposal(proposalId: string) {
  const [row] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.proposalId, proposalId))
    .limit(1);
  return row ?? null;
}
