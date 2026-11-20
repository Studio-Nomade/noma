import { NextResponse } from "next/server";
import { gateCronRequest } from "@/lib/cron";
import { flushPendingSlackNotices } from "@/features/slack-notify/process";
import {
  ensureLinkWebhooks,
  reconcileLinkStories,
} from "@/features/slack-notify/webhooks";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Mantención de los avisos de Asana en Slack (diario, 07:50 Santiago):
 * 1. Webhooks: cada proyecto vinculado y activo con su webhook vivo (lo
 *    registra o lo recrea si Asana lo apagó); los vínculos apagados, sin él.
 * 2. Reconciliación: menciones y tareas reabiertas de las últimas 24 h que no
 *    se avisaron (por ejemplo, con el webhook caído).
 * `?dry=1` solo informa qué haría.
 */
export async function GET(request: Request) {
  const gate = gateCronRequest(request, "slack-notify");
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const dryRun = new URL(request.url).searchParams.get("dry") === "1";
  const deadline = Date.now() + 270_000;
  const webhooks = await ensureLinkWebhooks({
    dryRun,
    deadline: deadline - 120_000,
  });
  const reconcile = await reconcileLinkStories({ dryRun, deadline });
  // Fuera del horario hábil, lo reconciliado queda en cola (08:55 hábil).
  const queue = dryRun ? null : await flushPendingSlackNotices({ deadline });
  return NextResponse.json({ ok: true, dryRun, webhooks, reconcile, queue });
}
