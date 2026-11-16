import { Cable, Check, CircleAlert, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectionButton } from "./connection-button";
import type { ConnectionState, PersonalConnectionStatus } from "./status";

const STATE_LABEL: Record<ConnectionState, string> = {
  connected: "Conectado",
  partial: "Faltan permisos",
  disconnected: "Sin conectar",
  error: "Reconectar",
  not_configured: "No configurado",
};

function reconnectHref(provider: PersonalConnectionStatus["provider"]) {
  const back = encodeURIComponent("/integrations");
  return provider === "google"
    ? `/login?reconsent=google&redirectTo=${back}`
    : `/api/integrations/${provider}/connect?redirectTo=${back}`;
}

/**
 * «Mis conexiones» en detalle: por cada cuenta personal, qué puede hacer Noma
 * y qué falta conceder, con reconexión de un clic.
 */
export function PersonalConnectionsDetail({
  connections,
  encryptionConfigured,
}: {
  connections: PersonalConnectionStatus[];
  encryptionConfigured: boolean;
}) {
  return (
    <section className="glass mt-8 rounded-xl p-4 sm:p-6">
      <div className="mb-5">
        <h2 className="font-heading flex items-center gap-2 text-sm font-medium">
          <Cable className="size-4" />
          Mis conexiones
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Tus cuentas personales y lo que tu asistente puede hacer con cada una.
          Los accesos se guardan cifrados y nunca llegan al navegador.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {connections.map((c) => {
          const needsReconnect = c.state === "partial" || c.state === "error";
          const isGoogle = c.provider === "google";
          return (
            <div
              key={c.provider}
              className="border-border flex flex-col gap-4 rounded-lg border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  {c.account && (
                    <p className="text-muted-foreground truncate text-xs">
                      {c.account}
                    </p>
                  )}
                </div>
                <Badge
                  variant={c.state === "connected" ? "secondary" : "outline"}
                >
                  {c.state === "connected" ? (
                    <Check data-icon="inline-start" />
                  ) : needsReconnect ? (
                    <CircleAlert data-icon="inline-start" />
                  ) : null}
                  {STATE_LABEL[c.state]}
                </Badge>
              </div>

              <ul className="flex flex-col gap-1.5 text-sm">
                {c.capabilities.map((cap) => (
                  <li key={cap.id} className="flex items-center gap-2">
                    {cap.granted ? (
                      <Check className="text-primary size-3.5 shrink-0" />
                    ) : (
                      <X className="text-muted-foreground size-3.5 shrink-0" />
                    )}
                    <span
                      className={cap.granted ? "" : "text-muted-foreground"}
                    >
                      {cap.label}
                    </span>
                  </li>
                ))}
              </ul>

              {c.message && (
                <p className="text-muted-foreground text-xs">{c.message}</p>
              )}
              {c.state === "partial" && (
                <p className="text-muted-foreground text-xs">
                  {isGoogle
                    ? "Vuelve a entrar y deja marcadas todas las casillas en la pantalla de Google."
                    : "Reconecta para conceder los permisos nuevos."}
                </p>
              )}
              {c.state === "not_configured" && (
                <p className="text-muted-foreground text-xs">
                  Faltan las credenciales OAuth en el entorno.
                </p>
              )}

              <div className="mt-auto flex flex-wrap gap-2">
                {(needsReconnect || (isGoogle && c.state === "disconnected")) &&
                  (isGoogle || encryptionConfigured) && (
                    <Button
                      render={<a href={reconnectHref(c.provider)} />}
                      variant={needsReconnect ? "default" : "outline"}
                      size="sm"
                    >
                      <RefreshCw />
                      {isGoogle ? "Reconectar Google" : "Reconectar"}
                    </Button>
                  )}
                {!isGoogle && c.state !== "not_configured" && (
                  <ConnectionButton
                    provider={c.provider as "slack" | "asana"}
                    connected={c.state !== "disconnected"}
                    configured
                    encryptionConfigured={encryptionConfigured}
                    redirectTo="/integrations"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
