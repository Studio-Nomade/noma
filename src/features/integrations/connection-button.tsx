"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { disconnectProvider } from "./actions";
import type { ConnectionProvider } from "./providers";

export function ConnectionButton({
  provider,
  connected,
  configured,
  encryptionConfigured,
  redirectTo = "/integrations",
}: {
  provider: ConnectionProvider;
  connected: boolean;
  configured: boolean;
  encryptionConfigured: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!connected) {
    const enabled = configured && encryptionConfigured;
    return enabled ? (
      <Button
        render={
          <a
            href={`/api/integrations/${provider}/connect?redirectTo=${encodeURIComponent(redirectTo)}`}
          />
        }
        variant="outline"
        size="sm"
      >
        <Link2 />
        Conectar
      </Button>
    ) : (
      <Button
        variant="outline"
        size="sm"
        disabled
        title={
          !encryptionConfigured
            ? "Falta configurar NOMA_TOKEN_ENCRYPTION_KEY."
            : "Faltan las credenciales OAuth del proveedor."
        }
      >
        <Link2 />
        Conectar
      </Button>
    );
  }

  function onDisconnect() {
    const accepted = window.confirm(
      `¿Desconectar tu cuenta de ${provider === "asana" ? "Asana" : "Slack"}?`,
    );
    if (!accepted) return;
    startTransition(async () => {
      const result = await disconnectProvider(provider);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cuenta desconectada.");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={onDisconnect}
    >
      <Unplug />
      {pending ? "Desconectando…" : "Desconectar"}
    </Button>
  );
}
