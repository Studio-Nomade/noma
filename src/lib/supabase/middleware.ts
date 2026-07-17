import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { devAuthEmail } from "@/lib/dev-auth";

/** Rutas accesibles sin sesión. */
const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * ¿El correo pertenece al dominio permitido del estudio?
 *
 * Se valida aquí (y no solo en /auth/callback) porque el callback únicamente
 * corre en el flujo de Google: una sesión creada por otra vía del Auth de
 * Supabase (p. ej. email/password con la publishable key, que es pública)
 * nunca pasaría por esa comprobación. Sin este chequeo, tener sesión válida
 * bastaría para entrar.
 */
function isAllowedEmail(email: string | undefined): boolean {
  const domain = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN;
  if (!domain) return true; // sin restricción configurada
  return !!email && email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

/**
 * Refresca la sesión Supabase en cada request y protege rutas privadas.
 * Basado en el patrón oficial de @supabase/ssr para Next.js.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Solo dev: el bypass de auth permite navegar sin sesión Supabase.
  const devBypass = Boolean(devAuthEmail());

  if (!user && !isPublic && !devBypass) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Sesión válida pero fuera del dominio del estudio: se cierra y se rechaza.
  if (user && !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    // Ya en una ruta pública: basta con devolver la respuesta (con las cookies
    // ya limpias) y evitar redirigir a /login sobre sí mismo.
    if (isPublic) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("error", "domain");
    const res = NextResponse.redirect(url);
    // signOut() borra las cookies sobre `supabaseResponse`; hay que arrastrarlas
    // a la redirección, si no la sesión sobreviviría.
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
