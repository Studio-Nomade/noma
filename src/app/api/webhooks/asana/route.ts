import { after } from "next/server";
import { resolveBotUserGid } from "@/features/asana/asana";
import {
  storyAddedEvents,
  taskAddedEvents,
  verifyAsanaSignature,
} from "@/features/asana/webhook-events";
import {
  acceptHandshake,
  getWebhookSecret,
  touchWebhook,
} from "@/features/asana/webhook-store";
import {
  flushScheduledDeliveries,
  processAsanaStory,
} from "@/features/email/deliveries";
import { isEmailChannelProject } from "@/features/email/store";
import { openThreadForTask } from "@/features/email/thread-open";
import { NEW_TASK_SETTLE_MS } from "@/features/email/thread-open-rules";
import {
  flushPendingSlackNotices,
  notifyAsanaStory,
  notifyNewTask,
} from "@/features/slack-notify/process";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Webhook de Asana por proyecto: /api/webhooks/asana?project=<gid>.
 *
 * - Handshake: la primera llamada trae X-Hook-Secret; se guarda cifrado (solo
 *   dentro de la ventana abierta por el script de registro) y se devuelve.
 * - Eventos: se valida X-Hook-Signature (HMAC-SHA256) y las stories nuevas
 *   se procesan con `after()`:
 *   - aviso en el canal de Slack vinculado al proyecto (todos los proyectos
 *     con vínculo activo);
 *   - flujo de solicitudes (ENTREGA → correo al cliente, Planificada al
 *     asignar…), solo en los proyectos de un canal de correo.
 */
export async function POST(request: Request) {
  const projectGid = new URL(request.url).searchParams.get("project")?.trim();
  if (!projectGid || !/^\d{1,32}$/.test(projectGid)) {
    return new Response("Bad request", { status: 400 });
  }

  const hookSecret = request.headers.get("x-hook-secret");
  if (hookSecret) {
    const accepted = await acceptHandshake(projectGid, hookSecret);
    if (!accepted) return new Response("Forbidden", { status: 403 });
    return new Response(null, {
      status: 204,
      headers: { "X-Hook-Secret": hookSecret },
    });
  }

  const rawBody = await request.text();
  const secret = await getWebhookSecret(projectGid);
  if (
    !verifyAsanaSignature(
      rawBody,
      request.headers.get("x-hook-signature"),
      secret,
    )
  ) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(null, { status: 204 });
  }
  const events = storyAddedEvents(payload);
  const newTasks = taskAddedEvents(payload);
  await touchWebhook(projectGid).catch(() => undefined);

  if (events.length || newTasks.length) {
    after(async () => {
      const emailProject = await isEmailChannelProject(projectGid).catch(
        (error) => {
          console.error("[asana:webhook:channel]", error);
          return false;
        },
      );
      // Tareas nuevas primero: abren el hilo donde caen los demás avisos.
      for (const event of newTasks) {
        await notifyNewTask({ taskGid: event.taskGid, projectGid });
      }
      let botUserGid: string;
      try {
        botUserGid = await resolveBotUserGid();
      } catch (error) {
        // Sin identidad del bot no se arriesga un loop; el cron reconcilia.
        console.error("[asana:webhook:bot]", error);
        return;
      }
      for (const event of events) {
        // Aviso en el canal de Slack del proyecto (si está vinculado). Va
        // también con lo que hace la cuenta de Noma: así los agentes avisan
        // al equipo sin cuentas personales.
        await notifyAsanaStory({ storyGid: event.storyGid, projectGid });
        // El flujo de solicitudes solo corre en proyectos de correo.
        if (!emailProject) continue;
        // Stories de Noma: solo comentarios (pueden ser «CLIENTE», que
        // registra un mensaje del cliente); el resto se ignora sin pedirlo.
        if (
          event.userGid === botUserGid &&
          event.subtype !== null &&
          event.subtype !== "comment_added"
        ) {
          continue;
        }
        try {
          await processAsanaStory(event.storyGid, {
            botUserGid,
            projectGid,
          });
        } catch (error) {
          console.error("[asana:webhook:story]", event.storyGid, error);
        }
      }
      // Tareas hechas a mano en un proyecto con canal: tras unos segundos
      // (que terminen de escribirla), Noma asigna folio y, con «Correo de
      // contacto», abre el hilo con el cliente.
      if (emailProject && newTasks.length) {
        await new Promise((resolve) => setTimeout(resolve, NEW_TASK_SETTLE_MS));
        for (const event of newTasks) {
          await openThreadForTask({
            taskGid: event.taskGid,
            projectGid,
            announce: true,
          });
        }
      }
      // De paso: avisos internos en cola cuya hora hábil ya llegó.
      await flushPendingSlackNotices({ deadline: Date.now() + 10_000 }).catch(
        (error) => console.error("[asana:webhook:slack-cola]", error),
      );
      if (!emailProject) return;
      // De paso: entregas programadas fuera de horario que ya vencieron.
      await flushScheduledDeliveries({
        limit: 5,
        deadline: Date.now() + 20_000,
      }).catch((error) => console.error("[asana:webhook:flush]", error));
    });
  }
  return new Response(null, { status: 200 });
}
