import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getOAuthProvider,
  providerCredentials,
  type ConnectionProvider,
} from "@/features/integrations/providers";
import { saveUserConnection } from "@/features/integrations/tokens";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

type OAuthCookie = {
  state: string;
  verifier: string | null;
  redirectTo: string;
};

type TokenResult = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  externalAccountId: string | null;
  meta: Record<string, unknown>;
};

function readCookie(value: string | undefined): OAuthCookie | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as OAuthCookie;
    return parsed.state && parsed.redirectTo ? parsed : null;
  } catch {
    return null;
  }
}

function errorRedirect(
  request: NextRequest,
  redirectTo: string,
  error: string,
) {
  const url = new URL(redirectTo, request.nextUrl.origin);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

async function exchangeCode(input: {
  provider: ConnectionProvider;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  verifier: string | null;
}): Promise<TokenResult | null> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    redirect_uri: input.redirectUri,
  });
  if (input.verifier) body.set("code_verifier", input.verifier);

  const response = await fetch(input.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok || json.ok === false) return null;

  if (input.provider === "slack") {
    const authedUser = (json.authed_user ?? {}) as Record<string, unknown>;
    const team = (json.team ?? {}) as Record<string, unknown>;
    const accessToken =
      typeof authedUser.access_token === "string"
        ? authedUser.access_token
        : null;
    if (!accessToken) return null;
    return {
      accessToken,
      refreshToken:
        typeof authedUser.refresh_token === "string"
          ? authedUser.refresh_token
          : null,
      expiresIn:
        typeof authedUser.expires_in === "number"
          ? authedUser.expires_in
          : null,
      externalAccountId:
        typeof authedUser.id === "string" ? authedUser.id : null,
      meta: {
        teamId: typeof team.id === "string" ? team.id : null,
        teamName: typeof team.name === "string" ? team.name : null,
        scope: typeof authedUser.scope === "string" ? authedUser.scope : null,
      },
    };
  }

  if (typeof json.access_token !== "string") return null;
  const data = (json.data ?? {}) as Record<string, unknown>;
  return {
    accessToken: json.access_token,
    refreshToken:
      typeof json.refresh_token === "string" ? json.refresh_token : null,
    expiresIn: typeof json.expires_in === "number" ? json.expires_in : null,
    externalAccountId:
      typeof data.gid === "string"
        ? data.gid
        : typeof data.id === "string"
          ? data.id
          : null,
    meta: {
      accountName: typeof data.name === "string" ? data.name : null,
      accountEmail: typeof data.email === "string" ? data.email : null,
      scope: typeof json.scope === "string" ? json.scope : null,
    },
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const user = await requireUser();
  const { provider: providerId } = await context.params;
  const provider = getOAuthProvider(providerId);
  if (!provider) {
    return errorRedirect(request, "/integrations", "unsupported_provider");
  }

  const cookieName = `noma_oauth_${provider.id}`;
  const oauthCookie = readCookie(request.cookies.get(cookieName)?.value);
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");
  const redirectTo = oauthCookie?.redirectTo ?? "/integrations";

  if (providerError) {
    return errorRedirect(request, redirectTo, `${provider.id}_denied`);
  }
  if (!oauthCookie || !state || state !== oauthCookie.state || !code) {
    return errorRedirect(request, redirectTo, "invalid_oauth_state");
  }

  const credentials = providerCredentials(provider);
  if (
    !credentials.clientId ||
    !credentials.clientSecret ||
    !credentials.configured
  ) {
    return errorRedirect(request, redirectTo, `${provider.id}_not_configured`);
  }

  try {
    const tokens = await exchangeCode({
      provider: provider.id,
      tokenUrl: provider.tokenUrl,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      code,
      redirectUri: new URL(
        provider.redirectPath,
        request.nextUrl.origin,
      ).toString(),
      verifier: oauthCookie.verifier,
    });
    if (!tokens) {
      return errorRedirect(request, redirectTo, `${provider.id}_oauth_failed`);
    }

    await saveUserConnection({
      userId: user.id,
      provider: provider.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1_000)
        : null,
      externalAccountId: tokens.externalAccountId,
      meta: tokens.meta,
    });
    await logActivity({
      entityType: "user_connection",
      entityId: user.id,
      action: `${provider.id}_connected`,
      actorId: user.id,
    });

    const url = new URL(redirectTo, request.nextUrl.origin);
    url.searchParams.set("connected", provider.id);
    const response = NextResponse.redirect(url);
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: `/api/integrations/${provider.id}`,
    });
    return response;
  } catch (error) {
    console.error(`[oauth:${provider.id}:callback]`, error);
    return errorRedirect(request, redirectTo, `${provider.id}_oauth_failed`);
  }
}
