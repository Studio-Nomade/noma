import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isSelfAuthenticatedPath } from "@/lib/self-authenticated-paths";

export async function middleware(request: NextRequest) {
  // Webhooks y crons validan su propia credencial (HMAC, token, CRON_SECRET):
  // no tienen sesión y no deben redirigirse a /login.
  if (isSelfAuthenticatedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Todas las rutas excepto archivos estáticos e imágenes:
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
