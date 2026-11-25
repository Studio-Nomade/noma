import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { peopleIdentities, userIntegrations } from "@/db/schema";
import { getUserEmail } from "@/features/asana/asana";
import { getGoogleAccessToken } from "@/features/google/auth";
import { normalizeEmail } from "./addresses";

/**
 * Modelo B: correo desde la cuenta de Google de la persona del estudio
 * (refresh token en `user_integrations`, scope gmail.send).
 */

export class UserMailboxError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "UserMailboxError";
  }
}

export type StudioSender = {
  userId: string;
  email: string;
};

/** Correo de una persona de Asana (identidades guardadas o la API). */
export async function emailForAsanaUser(asanaUserGid: string) {
  const [identity] = await db
    .select({ email: peopleIdentities.email })
    .from(peopleIdentities)
    .where(eq(peopleIdentities.asanaUserGid, asanaUserGid))
    .limit(1);
  if (identity?.email) return normalizeEmail(identity.email);
  const email = await getUserEmail(asanaUserGid).catch(() => null);
  return email ? normalizeEmail(email) : null;
}

/** Cuenta de Google conectada en Noma para ese correo (null: no hay). */
export async function studioSenderFor(email: string | null) {
  if (!email) return null;
  const [row] = await db
    .select({
      userId: userIntegrations.userId,
      email: userIntegrations.email,
      token: userIntegrations.googleRefreshToken,
    })
    .from(userIntegrations)
    .where(eq(userIntegrations.email, normalizeEmail(email)))
    .limit(1);
  if (!row?.token || !row.email) return null;
  return { userId: row.userId, email: normalizeEmail(row.email) };
}

/**
 * Envía un mensaje RFC 822 ya armado desde la casilla de la persona. Con
 * adjuntos usa el endpoint de subida (hasta 35 MB).
 */
export async function sendAsStudioUser(input: {
  userId: string;
  raw: string;
  threadId?: string | null;
  large?: boolean;
}): Promise<{ id: string; threadId: string }> {
  const token = await getGoogleAccessToken(input.userId);
  let res: Response;
  try {
    if (input.large) {
      const boundary = `noma_upload_${Date.now().toString(36)}`;
      const body = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(input.threadId ? { threadId: input.threadId } : {})}\r\n--${boundary}\r\nContent-Type: message/rfc822\r\n\r\n`,
          "utf8",
        ),
        Buffer.from(input.raw, "utf8"),
        Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
      ]);
      res = await fetch(
        "https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
          cache: "no-store",
          signal: AbortSignal.timeout(45_000),
        },
      );
    } else {
      res = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            raw: Buffer.from(input.raw, "utf8").toString("base64url"),
            ...(input.threadId ? { threadId: input.threadId } : {}),
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        },
      );
    }
  } catch {
    throw new UserMailboxError("No se pudo conectar con Gmail.", null);
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new UserMailboxError(
      `Gmail (cuenta personal) → HTTP ${res.status}: ${detail}`,
      res.status,
    );
  }
  return (await res.json()) as { id: string; threadId: string };
}
