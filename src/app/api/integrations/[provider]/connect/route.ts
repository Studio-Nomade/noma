import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getOAuthProvider,
  providerCredentials,
} from "@/features/integrations/providers";

export const runtime = "nodejs";

function safeRedirectTo(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/integrations";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  await requireUser();
  const { provider: providerId } = await context.params;
  const provider = getOAuthProvider(providerId);
  const redirectTo = safeRedirectTo(
    request.nextUrl.searchParams.get("redirectTo"),
  );

  if (!provider) {
    return NextResponse.redirect(
      new URL(`${redirectTo}?error=unsupported_provider`, request.url),
    );
  }

  const credentials = providerCredentials(provider);
  if (!credentials.configured || !credentials.clientId) {
    return NextResponse.redirect(
      new URL(
        `${redirectTo}?error=${encodeURIComponent(`${provider.id}_not_configured`)}`,
        request.url,
      ),
    );
  }

  const state = randomBytes(32).toString("base64url");
  const verifier = provider.usePkce
    ? randomBytes(64).toString("base64url")
    : null;
  const callbackUrl = new URL(provider.redirectPath, request.nextUrl.origin);
  const authorizeUrl = new URL(provider.authorizeUrl);
  authorizeUrl.searchParams.set("client_id", credentials.clientId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl.toString());
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);
  if (provider.scopes.length > 0) {
    authorizeUrl.searchParams.set(
      provider.scopeParam,
      provider.scopeParam === "user_scope"
        ? provider.scopes.join(",")
        : provider.scopes.join(" "),
    );
  }
  if (verifier) {
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set(
      "code_challenge",
      createHash("sha256").update(verifier).digest("base64url"),
    );
  }

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(
    `noma_oauth_${provider.id}`,
    Buffer.from(
      JSON.stringify({ state, verifier, redirectTo }),
      "utf8",
    ).toString("base64url"),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60,
      path: `/api/integrations/${provider.id}`,
    },
  );
  return response;
}
