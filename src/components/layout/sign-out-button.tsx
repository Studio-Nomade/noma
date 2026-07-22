"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={pending}
      aria-label={pending ? "Cerrando sesión" : "Cerrar sesión"}
      title={iconOnly ? "Cerrar sesión" : undefined}
      className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2 rounded-md p-2 text-xs transition-colors disabled:opacity-50"
    >
      <LogOut className="size-3.5" />
      {!iconOnly && (pending ? "Cerrando…" : "Cerrar sesión")}
    </button>
  );
}
