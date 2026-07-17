import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userIntegrations } from "@/db/schema";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // Restricción opcional de dominio (Google Workspace del estudio).
  const allowedDomain = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN;
  const email = data.user?.email ?? "";
  if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  // Guarda el refresh token de Google para enviar correos como el usuario (Gmail API).
  const refreshToken = data.session?.provider_refresh_token;
  if (data.user?.id && refreshToken) {
    await db
      .insert(userIntegrations)
      .values({
        userId: data.user.id,
        email,
        googleRefreshToken: refreshToken,
      })
      .onConflictDoUpdate({
        target: userIntegrations.userId,
        set: { email, googleRefreshToken: refreshToken, updatedAt: new Date() },
      });
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
