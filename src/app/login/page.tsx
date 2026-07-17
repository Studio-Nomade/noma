"use client";

import { useEffect, useState } from "react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(
          redirectTo,
        )}`,
        // Scopes de Google concedidos al usuario (refresh token offline):
        // - gmail.send: enviar correos como el usuario
        // - calendar.events: crear reuniones de brief con link de Meet (Fase 5)
        // - drive.readonly: leer notas de Gemini y buscar documentos (Fase 6)
        scopes:
          "email profile " +
          "https://www.googleapis.com/auth/gmail.send " +
          "https://www.googleapis.com/auth/calendar.events " +
          "https://www.googleapis.com/auth/drive.readonly",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      toast.error("No se pudo iniciar sesión. Intenta nuevamente.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="border-border bg-card w-full max-w-sm rounded-2xl border p-8 text-center">
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
