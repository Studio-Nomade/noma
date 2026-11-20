"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { asanaSlackLinks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { roleFor } from "@/lib/roles";
import { SLACK_EVENT_KINDS, eventEnabled, slackEscape } from "./format";
import { linkProjectToChannel } from "./links";
import { postBotMessage, slackBotConfigured } from "./slack-bot";
import { ensureLinkWebhooks } from "./webhooks";

const PATH = "/settings/slack-links";

/** Solo Dirección (superadmin: Sebastián, Ana) edita los vínculos. */
async function requireDireccion() {
  const user = await requireUser();
  if (!roleFor(user.email).isSuperAdmin) {
    throw new Error("Acción no autorizada: requiere Dirección.");
  }
  return user;
}

/** Registra o quita el webhook del proyecto según su vínculo. */
async function syncWebhook(projectGid: string) {
  const [report] = await ensureLinkWebhooks({ projectGid });
  return report?.action === "error"
    ? `El vínculo quedó guardado, pero el webhook falló: ${report.error ?? "error"}.`
    : null;
}

const linkSchema = z.object({
  asanaProjectGid: z.string().regex(/^\d{6,32}$/, "Elige un proyecto."),
  asanaProjectName: z.string().min(1).max(200),
  slackChannelId: z.string().regex(/^[CG][A-Z0-9]{6,}$/, "Elige un canal."),
  slackChannelName: z.string().min(1).max(80),
  folioPrefix: z
    .string()
    .trim()
    .max(10)
    .transform((v) => v || null)
    .nullable()
    .optional(),
});

/** Vincula un proyecto a un canal (o lo cambia de canal). */
export async function saveSlackLink(
  input: z.input<typeof linkSchema>,
): Promise<ActionResult<{ warning: string | null }>> {
  try {
    await requireDireccion();
    const data = linkSchema.parse(input);
    await linkProjectToChannel(data);
    const warning = await syncWebhook(data.asanaProjectGid);
    revalidatePath(PATH);
    return { ok: true, data: { warning } };
  } catch (err) {
    return handleActionError(err, "saveSlackLink");
  }
}

const eventSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(SLACK_EVENT_KINDS),
  enabled: z.boolean(),
});

/** Enciende o apaga un tipo de aviso de un vínculo (sin redeploy). */
export async function setSlackLinkEvent(
  input: z.input<typeof eventSchema>,
): Promise<ActionResult> {
  try {
    await requireDireccion();
    const { id, kind, enabled } = eventSchema.parse(input);
    await db
      .update(asanaSlackLinks)
      .set({
        events: sql`${asanaSlackLinks.events} || jsonb_build_object(${kind}::text, ${enabled}::boolean)`,
        updatedAt: sql`now()`,
      })
      .where(eq(asanaSlackLinks.id, id));
    revalidatePath(PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "setSlackLinkEvent");
  }
}

/** Activa o desactiva un vínculo (y registra o borra su webhook). */
export async function setSlackLinkActive(input: {
  id: string;
  active: boolean;
}): Promise<ActionResult<{ warning: string | null }>> {
  try {
    await requireDireccion();
    const { id, active } = z
      .object({ id: z.string().uuid(), active: z.boolean() })
      .parse(input);
    const [link] = await db
      .update(asanaSlackLinks)
      .set({ active, updatedAt: sql`now()` })
      .where(eq(asanaSlackLinks.id, id))
      .returning({ projectGid: asanaSlackLinks.asanaProjectGid });
    if (!link) return { ok: false, error: "Vínculo no encontrado." };
    const warning = await syncWebhook(link.projectGid);
    revalidatePath(PATH);
    return { ok: true, data: { warning } };
  } catch (err) {
    return handleActionError(err, "setSlackLinkActive");
  }
}

/** Publica un mensaje de prueba del bot en el canal del vínculo. */
export async function testSlackLink(id: string): Promise<ActionResult> {
  try {
    await requireDireccion();
    if (!slackBotConfigured()) {
      return { ok: false, error: "Falta SLACK_BOT_TOKEN (bot de Noma)." };
    }
    const [link] = await db
      .select()
      .from(asanaSlackLinks)
      .where(eq(asanaSlackLinks.id, z.string().uuid().parse(id)))
      .limit(1);
    if (!link) return { ok: false, error: "Vínculo no encontrado." };
    const active = SLACK_EVENT_KINDS.filter((kind) =>
      eventEnabled(link.events, kind),
    );
    try {
      await postBotMessage({
        channel: link.slackChannelId,
        text: `Prueba de avisos de Noma: ${link.asanaProjectName}`,
        mrkdwn: `🧪 Prueba de avisos · *${slackEscape(link.asanaProjectName)}* llega a este canal (${active.length} de ${SLACK_EVENT_KINDS.length} avisos encendidos).`,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      return {
        ok: false,
        error: /not_in_channel|channel_not_found/.test(code)
          ? "El bot no está en el canal: invita a @Noma (canal privado)."
          : "Slack rechazó el mensaje de prueba.",
      };
    }
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "testSlackLink");
  }
}

/** Revisa ahora los webhooks de todos los vínculos (lo mismo que el cron). */
export async function runSlackLinkWebhooks(): Promise<
  ActionResult<{ ok: number; registered: number; errors: number }>
> {
  try {
    await requireDireccion();
    const report = await ensureLinkWebhooks({ deadline: Date.now() + 50_000 });
    revalidatePath(PATH);
    return {
      ok: true,
      data: {
        ok: report.filter((r) => r.action === "ok").length,
        registered: report.filter((r) => r.action === "register").length,
        errors: report.filter((r) => r.action === "error").length,
      },
    };
  } catch (err) {
    return handleActionError(err, "runSlackLinkWebhooks");
  }
}
