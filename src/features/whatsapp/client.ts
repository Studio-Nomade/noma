import "server-only";

export type WhatsAppSendResult =
  | { connected: true; id: string }
  | { connected: false; reason: string };

type MetaSendResponse = {
  messages?: { id?: string }[];
};

export async function sendText(
  to: string,
  body: string,
): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) {
    return {
      connected: false,
      reason:
        "WhatsApp no está configurado (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID).",
    };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to.replace(/\D/g, ""),
          type: "text",
          text: { preview_url: false, body },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) {
      return {
        connected: false,
        reason:
          response.status === 401 || response.status === 403
            ? "Meta rechazó la credencial configurada."
            : "WhatsApp no está disponible en este momento.",
      };
    }
    const payload = (await response.json()) as MetaSendResponse;
    const id = payload.messages?.[0]?.id;
    if (!id) {
      return {
        connected: false,
        reason: "Meta devolvió una respuesta sin identificador de mensaje.",
      };
    }
    return { connected: true, id };
  } catch {
    return {
      connected: false,
      reason: "No se pudo conectar con WhatsApp.",
    };
  }
}
