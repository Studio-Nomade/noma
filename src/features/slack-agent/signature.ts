import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificación de la firma de Slack (`X-Slack-Signature`) sobre el cuerpo
 * crudo. Rechaza firmas de más de 5 minutos para evitar reenvíos. Puro.
 */
export function verifySlackSignature(input: {
  signingSecret: string | undefined;
  timestamp: string | null;
  signature: string | null;
  body: string;
  now?: number;
}): boolean {
  const { signingSecret, timestamp, signature, body } = input;
  if (!signingSecret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return false;
  const expected =
    "v0=" +
    createHmac("sha256", signingSecret)
      .update(`v0:${timestamp}:${body}`)
      .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
