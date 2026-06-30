import { eq } from "drizzle-orm";
import { db } from "@/db";
import { slas } from "@/db/schema";

export async function getSlaByProposal(proposalId: string) {
  const [row] = await db
    .select()
    .from(slas)
    .where(eq(slas.proposalId, proposalId))
    .limit(1);
  return row ?? null;
}

export async function getSla(id: string) {
  const [row] = await db.select().from(slas).where(eq(slas.id, id)).limit(1);
  return row ?? null;
}
