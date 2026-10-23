/**
 * Verificación y decodificación del push de Gmail (Cloud Pub/Sub).
 *
 * Dos capas: token compartido en la URL de la suscripción
 * (`?token=NOMA_GMAIL_PUSH_TOKEN`, obligatorio) y, si se configura
 * NOMA_GMAIL_PUSH_AUDIENCE, el JWT OIDC firmado por Google que Pub/Sub envía en
 * `Authorization: Bearer`. Módulo sin DB; la descarga de llaves es inyectable.
 */

import {
  createPublicKey,
  createVerify,
  timingSafeEqual,
  type JsonWebKey,
} from "node:crypto";

export type GmailPushNotification = { emailAddress: string; historyId: string };

export function decodePushBody(body: unknown): GmailPushNotification | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as { message?: { data?: unknown } }).message?.data;
  if (typeof data !== "string" || !data) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64").toString("utf8")) as {
      emailAddress?: unknown;
      historyId?: unknown;
    };
    const emailAddress =
      typeof parsed.emailAddress === "string"
        ? parsed.emailAddress.trim().toLowerCase()
        : "";
    const historyId =
      typeof parsed.historyId === "string" ||
      typeof parsed.historyId === "number"
        ? String(parsed.historyId)
        : "";
    if (!emailAddress || !/^\d+$/.test(historyId)) return null;
    return { emailAddress, historyId };
  } catch {
    return null;
  }
}

export function safeEqual(
  a: string | null | undefined,
  b: string | null | undefined,
) {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// ── OIDC (opcional) ──────────────────────────────────────────
export type Jwk = JsonWebKey & { kid?: string; alg?: string };
export type JwksFetcher = () => Promise<Jwk[]>;

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

let cachedKeys: { keys: Jwk[]; expiresAt: number } | null = null;

/** Llaves públicas de Google (cacheadas 1 h en memoria). */
export const fetchGoogleJwks: JwksFetcher = async () => {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`Google JWKS HTTP ${res.status}`);
  const json = (await res.json()) as { keys?: Jwk[] };
  const keys = json.keys ?? [];
  cachedKeys = { keys, expiresAt: Date.now() + 60 * 60 * 1_000 };
  return keys;
};

function decodeSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

/**
 * Valida firma RS256, emisor Google, audiencia, expiración y (opcional) el
 * correo de la cuenta de servicio que firma el push.
 */
export async function verifyGoogleOidcToken(
  token: string,
  options: {
    audience: string;
    serviceAccountEmail?: string | null;
    fetchJwks?: JwksFetcher;
    now?: number;
  },
): Promise<boolean> {
  const segments = token.split(".");
  if (segments.length !== 3) return false;
  try {
    const header = decodeSegment<{ alg?: string; kid?: string }>(segments[0]);
    const claims = decodeSegment<{
      iss?: string;
      aud?: string | string[];
      exp?: number;
      iat?: number;
      email?: string;
      email_verified?: boolean;
    }>(segments[1]);
    if (header.alg !== "RS256" || !header.kid) return false;

    const keys = await (options.fetchJwks ?? fetchGoogleJwks)();
    const jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk) return false;
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${segments[0]}.${segments[1]}`);
    const valid = verifier.verify(
      createPublicKey({ key: jwk, format: "jwk" }),
      Buffer.from(segments[2], "base64url"),
    );
    if (!valid) return false;

    const now = Math.floor((options.now ?? Date.now()) / 1_000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!GOOGLE_ISSUERS.includes(claims.iss ?? "")) return false;
    if (!audiences.includes(options.audience)) return false;
    if (!claims.exp || claims.exp + 60 < now) return false;
    if (
      options.serviceAccountEmail &&
      (claims.email?.toLowerCase() !==
        options.serviceAccountEmail.toLowerCase() ||
        claims.email_verified === false)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
