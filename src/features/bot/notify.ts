import "server-only";

const TIMEOUT_MS = 5_000;

type SlackBlock = {
  type: "section";
  text: { type: "mrkdwn"; text: string };
};

async function sendOperationsNotification(
  text: string,
  blocks: SlackBlock[],
): Promise<{ connected: boolean; reason?: string }> {
  const webhookUrl = process.env.SLACK_OPERATIONS_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return { connected: false, reason: "Slack operativo no configurado." };
  }
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, blocks }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return { connected: false, reason: `Slack HTTP ${response.status}.` };
    }
    return { connected: true };
  } catch (error) {
    console.error("[bot:notify:slack]", error);
    return { connected: false, reason: "Slack no disponible." };
  }
}

function clean(value: string) {
  return value.replace(/[<>&]/g, "").slice(0, 500);
}

export async function notifyNewClientRequest(input: {
  requestId: string;
  clientName: string;
  projectName?: string | null;
  summary: string;
  /** Se recibe por compatibilidad; ya no se muestra en el aviso. */
  scopeClass?: string;
  asanaUrl?: string | null;
  /** Datos opcionales del canal correo para que el equipo se asigne la tarea. */
  folio?: string | null;
  endClient?: string | null;
  channels?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  requester?: string | null;
  assigned?: boolean;
}) {
  // Por ahora solo Asana: es donde el equipo se asigna y trabaja la tarea.
  const links = input.asanaUrl ? `<${input.asanaUrl}|Abrir en Asana>` : null;
  const details = [
    input.endClient ? `Cliente final: ${clean(input.endClient)}` : null,
    input.channels ? `Canal: ${clean(input.channels)}` : null,
    input.priority ? `Prioridad: *${clean(input.priority)}*` : null,
    input.dueDate ? `Entrega: ${clean(input.dueDate)}` : null,
    input.requester ? `Pide: ${clean(input.requester)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const body = [
    `${input.folio ? `\`${clean(input.folio)}\` · ` : ""}*${clean(input.clientName)}${input.projectName ? ` · ${clean(input.projectName)}` : ""}*`,
    clean(input.summary),
    details || null,
    input.assigned === false
      ? "🙋 *Sin responsable*: revísenla en el tablero y asígnensela."
      : null,
    links,
  ]
    .filter(Boolean)
    .join("\n");
  return sendOperationsNotification(
    input.folio
      ? `Nueva solicitud ${input.folio}`
      : "Nueva solicitud de cliente",
    [{ type: "section", text: { type: "mrkdwn", text: body } }],
  );
}

export async function notifyUnknownWhatsAppSender(phone: string) {
  const masked = `${phone.slice(0, 4)}••••${phone.slice(-3)}`;
  return sendOperationsNotification("Remitente de WhatsApp no acreditado", [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Remitente no acreditado*\nNúmero: \`${masked}\`\nNo se creó una solicitud ni una tarea.`,
      },
    },
  ]);
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}•••@${domain}`;
}

/** Correo a un alias desde un remitente no autorizado: queda en revisión. */
export async function notifyUnknownEmailSender(input: {
  alias: string;
  fromEmail: string;
  subject: string;
  clientName?: string | null;
  /** Motivo (p. ej. remitente sin autenticación DMARC/DKIM/SPF). */
  reason?: string | null;
}) {
  return sendOperationsNotification("Correo de remitente no autorizado", [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "*Correo en revisión (remitente no autorizado)*",
          `Alias: \`${clean(input.alias)}\`${input.clientName ? ` · ${clean(input.clientName)}` : ""}`,
          `Remitente: \`${clean(maskEmail(input.fromEmail))}\``,
          `Asunto: ${clean(input.subject).slice(0, 160)}`,
          ...(input.reason
            ? [`Motivo: ${clean(input.reason).slice(0, 200)}`]
            : []),
          "No se creó solicitud ni tarea. Si corresponde, agrega el dominio o el contacto y re-encola el evento.",
        ].join("\n"),
      },
    },
  ]);
}

/**
 * Correo a un alias que la IA no reconoció como solicitud (felicitación,
 * comentario, respuesta a un comunicado…): no se creó tarea ni se respondió.
 */
export async function notifyEmailWithoutRequest(input: {
  alias: string;
  fromEmail: string;
  fromName?: string | null;
  subject: string;
  clientName?: string | null;
  reason: string;
}) {
  const who = input.fromName
    ? `${clean(input.fromName)} (${clean(input.fromEmail)})`
    : clean(input.fromEmail);
  return sendOperationsNotification("Correo sin solicitud", [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `💬 *Correo sin solicitud*${input.clientName ? ` · ${clean(input.clientName)}` : ""}`,
          `De: ${who}`,
          `Asunto: ${clean(input.subject).slice(0, 160)}`,
          `Lectura: ${clean(input.reason).slice(0, 200)}`,
          `No se creó tarea ni se respondió. Está en la casilla \`${clean(input.alias)}\`; si era un pedido, reenvíenlo al alias como correo nuevo.`,
        ].join("\n"),
      },
    },
  ]);
}
