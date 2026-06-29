import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userIntegrations } from "@/db/schema";

/**
 * Envío de correo como el usuario, vía Gmail API.
 * Requiere: scope gmail.send concedido al iniciar sesión (refresh token guardado
 * en user_integrations) + GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en el entorno.
 */

function b64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeSubject(subject: string) {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

async function getAccessToken(userId: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Falta configurar GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET para enviar correos.",
    );
  }
  const [row] = await db
    .select({ token: userIntegrations.googleRefreshToken })
    .from(userIntegrations)
    .where(eq(userIntegrations.userId, userId))
    .limit(1);
  if (!row?.token) {
    throw new Error(
      "Tu cuenta no tiene permiso de envío de Gmail. Cierra sesión y vuelve a entrar para conceder el acceso.",
    );
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.token,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(
      "No se pudo renovar el acceso a Google. Reintenta el login.",
    );
  }
  return json.access_token;
}

export async function sendGmail(opts: {
  userId: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  attachment?: { filename: string; content: Buffer; mime?: string };
}): Promise<void> {
  const accessToken = await getAccessToken(opts.userId);
  const boundary = `noma_${Date.now()}`;
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to.join(", ")}`,
    opts.cc && opts.cc.length ? `Cc: ${opts.cc.join(", ")}` : "",
    `Subject: ${encodeSubject(opts.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean);

  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(opts.body, "utf8").toString("base64"),
  ];

  if (opts.attachment) {
    const mime = opts.attachment.mime ?? "application/pdf";
    parts.push(
      `--${boundary}`,
      `Content-Type: ${mime}; name="${opts.attachment.filename}"`,
      `Content-Disposition: attachment; filename="${opts.attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      opts.attachment.content.toString("base64"),
    );
  }
  parts.push(`--${boundary}--`, "");

  const raw = b64url(`${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`);

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gmail rechazó el envío: ${txt.slice(0, 160)}`);
  }
}
