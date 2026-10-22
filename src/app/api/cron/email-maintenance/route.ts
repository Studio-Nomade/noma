import { NextResponse } from "next/server";
import { gateCronRequest } from "@/lib/cron";
import {
  flagStuckDeliveries,
  reconcileAsanaDeliveries,
} from "@/features/email/deliveries";
import { processPendingEmails } from "@/features/email/processor";
import { renewMailboxWatch, syncMailboxHistory } from "@/features/email/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Mantenimiento del canal correo (Vercel Cron, Bearer CRON_SECRET):
 * 1. Renueva el watch de Gmail (expira a los 7 días).
 * 2. Reconcilia el history de Gmail (pushes perdidos) y procesa la cola,
 *    incluidos fallidos (< 5 intentos).
 * 3. Marca entregas trabadas y reconcilia comentarios ENTREGA de Asana
 *    (webhooks perdidos).
 *
 * En Hobby corre una vez al día; en Pro conviene cada 10 min.
 */
export async function GET(request: Request) {
  const gate = gateCronRequest(request, "email-maintenance");
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });

  const deadline = Date.now() + 50_000;
  const report: Record<string, unknown> = {};
  const step = async (name: string, run: () => Promise<unknown>) => {
    if (Date.now() > deadline) {
      report[name] = { skipped: "sin tiempo" };
      return;
    }
    try {
      report[name] = await run();
    } catch (error) {
      console.error(`[cron:email-maintenance:${name}]`, error);
      report[name] = {
        error: error instanceof Error ? error.message.slice(0, 200) : "error",
      };
    }
  };

  await step("watch", () => renewMailboxWatch());
  await step("gmailSync", () => syncMailboxHistory());
  await step("queue", async () => {
    // Se empiezan eventos solo en los primeros ~20 s: el que esté en curso
    // alcanza a terminar y quedan pasos para entregas trabadas y Asana.
    const results = await processPendingEmails({
      limit: 25,
      includeFailed: true,
      deadline: deadline - 30_000,
    });
    return {
      processed: results.length,
      failed: results.filter((result) => result.status === "failed").length,
    };
  });
  await step("stuckDeliveries", () => flagStuckDeliveries());
  await step("asanaReconcile", () =>
    reconcileAsanaDeliveries({ deadline: deadline - 5_000 }),
  );

  return NextResponse.json({ ok: true, ...report });
}
