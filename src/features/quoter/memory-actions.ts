"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { proposals, quoterLearnings } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { handleActionError, type ActionResult } from "@/lib/actions";
import {
  AREAS,
  QUOTER_LEARNING_KINDS,
  QUOTER_LEARNING_SCOPES,
} from "@/types/enums";

const learningInput = z
  .object({
    statement: z
      .string()
      .trim()
      .min(8, "Escribe la regla en una oración.")
      .max(600),
    kind: z.enum(QUOTER_LEARNING_KINDS),
    scope: z.enum(QUOTER_LEARNING_SCOPES),
    area: z.enum(AREAS).nullable().optional(),
    industry: z.string().trim().max(120).nullable().optional(),
    rationale: z.string().trim().max(1_000).nullable().optional(),
    proposalId: z.string().uuid().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scope === "area" && !value.area) {
      ctx.addIssue({
        code: "custom",
        message: "Elige el área.",
        path: ["area"],
      });
    }
    if (value.scope === "rubro" && !value.industry) {
      ctx.addIssue({
        code: "custom",
        message: "Escribe el rubro.",
        path: ["industry"],
      });
    }
    if (value.scope === "cliente" && !value.proposalId) {
      ctx.addIssue({
        code: "custom",
        message: "Las reglas de cliente se enseñan desde una propuesta.",
        path: ["scope"],
      });
    }
  });

async function requireEditor() {
  const user = await requireUser();
  if (roleFor(user.email).isReadOnly) {
    throw new Error("Acción no autorizada: tu perfil es de lectura.");
  }
  return user;
}

/** "Enseñar a Noma": regla escrita por el equipo, activa de inmediato. */
export async function addLearning(
  values: z.input<typeof learningInput>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireEditor();
    const input = learningInput.parse(values);
    let clientId: string | null = null;
    if (input.proposalId) {
      const [proposal] = await db
        .select({ clientId: proposals.clientId })
        .from(proposals)
        .where(eq(proposals.id, input.proposalId))
        .limit(1);
      clientId = proposal?.clientId ?? null;
    }
    const [row] = await db
      .insert(quoterLearnings)
      .values({
        kind: input.kind,
        scope: input.scope,
        area: input.scope === "area" ? (input.area ?? null) : null,
        industry: input.scope === "rubro" ? (input.industry ?? null) : null,
        clientId: input.scope === "cliente" ? clientId : null,
        statement: input.statement,
        rationale: input.rationale || null,
        origin: "equipo",
        sourceProposalId: input.proposalId ?? null,
        createdBy: user.id,
        createdByEmail: user.email ?? null,
      })
      .returning({ id: quoterLearnings.id });
    revalidatePath("/proposals/memoria");
    if (input.proposalId) revalidatePath(`/proposals/${input.proposalId}`);
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return handleActionError(err, "addLearning");
  }
}

export async function setLearningActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    await requireEditor();
    const input = z
      .object({ id: z.string().uuid(), active: z.boolean() })
      .parse({ id, active });
    await db
      .update(quoterLearnings)
      .set({ active: input.active, updatedAt: new Date() })
      .where(eq(quoterLearnings.id, input.id));
    revalidatePath("/proposals/memoria");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "setLearningActive");
  }
}

export async function updateLearningStatement(
  id: string,
  statement: string,
): Promise<ActionResult> {
  try {
    await requireEditor();
    const input = z
      .object({
        id: z.string().uuid(),
        statement: z.string().trim().min(8).max(600),
      })
      .parse({ id, statement });
    await db
      .update(quoterLearnings)
      .set({ statement: input.statement, updatedAt: new Date() })
      .where(eq(quoterLearnings.id, input.id));
    revalidatePath("/proposals/memoria");
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "updateLearningStatement");
  }
}
