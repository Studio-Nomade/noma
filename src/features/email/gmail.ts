import { getGoogleAccessToken } from "@/features/google/auth";

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

type Attachment = { filename: string; content: Buffer; mime?: string };

export async function sendGmail(opts: {
  userId: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  attachment?: Attachment;
  attachments?: Attachment[];
}): Promise<void> {
  const accessToken = await getGoogleAccessToken(opts.userId);
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

  const all = [...(opts.attachment ? [opts.attachment] : []), ...(opts.attachments ?? [])];
  for (const att of all) {
    const mime = att.mime ?? "application/pdf";
    parts.push(
      `--${boundary}`,
      `Content-Type: ${mime}; name="${att.filename}"`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      att.content.toString("base64"),
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
