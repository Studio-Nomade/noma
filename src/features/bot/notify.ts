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

function appUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return base ? `${base.replace(/\/$/, "")}${path}` : null;
}

function clean(value: string) {
  return value.replace(/[<>&]/g, "").slice(0, 500);
}

export async function notifyNewClientRequest(input: {
  requestId: string;
  clientName: string;
  projectName?: string | null;
  summary: string;
  scopeClass: string;
  asanaUrl?: string | null;
}) {
  const panelUrl = appUrl(`/solicitudes/${input.requestId}`);
  const links = [
    input.asanaUrl ? `<${input.asanaUrl}|Abrir en Asana>` : null,
    panelUrl ? `<${panelUrl}|Abrir en Noma>` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const body = [
    `*${clean(input.clientName)}${input.projectName ? ` · ${clean(input.projectName)}` : ""}*`,
    clean(input.summary),
    `Alcance: \`${clean(input.scopeClass)}\``,
    links,
  ]
    .filter(Boolean)
    .join("\n");
  return sendOperationsNotification("Nueva solicitud de cliente", [
    { type: "section", text: { type: "mrkdwn", text: body } },
  ]);
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
