"use client";

import { useState } from "react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

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
        <Button
          onClick={signInWithGoogle}
          disabled={loading}
          className="mt-8 w-full"
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
