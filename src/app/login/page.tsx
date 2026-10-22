"use client";

import { useEffect, useState } from "react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  REQUESTS_MAILBOX_LOGIN_PARAM,
  REQUESTS_MAILBOX_LOGIN_VALUE,
  googleLoginScopes,
} from "@/features/google/scopes";
import { toast } from "sonner";

/** Motivos de rechazo que llegan como ?error= desde el callback o el middleware. */
const ERROR_MESSAGES: Record<string, string> = {
  domain: "Esa cuenta no pertenece a Studio Nomade. Ingresa con tu correo del estudio.",
  auth: "No se pudo completar el inicio de sesión. Intenta nuevamente.",
  missing_code: "El enlace de acceso expiró. Intenta iniciar sesión otra vez.",
};

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);

  // Motivo del rechazo (si no, el usuario vuelve al login sin explicación).
  // Se muestra inline y no como toast: es un mensaje que debe permanecer visible.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setRejection(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.auth);
  }, []);

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const params = new URLSearchParams(window.location.search);
    const redirectTo = params.get("redirectTo") ?? "/";
    // /login?mailbox=requests: la casilla de solicitudes pide además
    // gmail.modify (ver src/features/google/scopes.ts).
    const requestsMailbox =
      params.get(REQUESTS_MAILBOX_LOGIN_PARAM) === REQUESTS_MAILBOX_LOGIN_VALUE;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(
          redirectTo,
        )}`,
        // Scopes de Google concedidos al usuario (refresh token offline).
        scopes: googleLoginScopes(requestsMailbox),
        // include_granted_scopes: un login normal posterior conserva los
        // scopes ya concedidos (si no, la casilla perdería gmail.modify).
        queryParams: {
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    });
    if (error) {
      toast.error("No se pudo iniciar sesión. Intenta nuevamente.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="glass-strong glass-sheen w-full max-w-sm rounded-2xl p-8 text-center">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Bienvenido a Noma
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Plataforma interna de Studio Nomade. Ingresa con tu cuenta del
          estudio.
        </p>

        {rejection && (
          <p
            role="alert"
            className="mt-6 rounded-lg px-3 py-2.5 text-sm"
            style={{
              color: "var(--status-red)",
              background: "var(--status-red-bg)",
            }}
          >
            {rejection}
          </p>
        )}

        <Button
          onClick={signInWithGoogle}
          disabled={loading}
          className={rejection ? "mt-4 w-full" : "mt-8 w-full"}
          size="lg"
        >
          {loading ? "Conectando…" : "Continuar con Google"}
        </Button>
        <p className="text-muted-foreground/70 mt-6 text-xs">
          Acceso restringido al equipo de Studio Nomade.
        </p>
      </div>
    </main>
  );
}
