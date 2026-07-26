import { Cable, CheckCircle2, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConnectionButton } from "./connection-button";
import type { IntegrationOverview } from "./queries";

export function UserConnectionsCard({
  connections,
  encryptionConfigured,
  redirectTo,
}: {
  connections: IntegrationOverview["personal"];
  encryptionConfigured: boolean;
  redirectTo: string;
}) {
  return (
    <section className="glass mt-8 rounded-xl p-4 sm:p-6">
      <div className="mb-5">
        <h2 className="font-heading flex items-center gap-2 text-sm font-medium">
          <Cable className="size-4" />
          Mis conexiones
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Cuentas personales. Los tokens se almacenan cifrados y nunca llegan al
          navegador.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {connections.map((connection) => {
          const name = connection.provider === "asana" ? "Asana" : "Slack";
          return (
            <div
              key={connection.provider}
              className="border-border flex items-center justify-between gap-4 rounded-lg border p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {connection.connected ? (
                    <CheckCircle2 className="text-primary size-4" />
                  ) : (
                    <CircleDashed className="text-muted-foreground size-4" />
                  )}
                  <p className="font-medium">{name}</p>
                  <Badge
                    variant={connection.connected ? "secondary" : "outline"}
                  >
                    {connection.connected ? "Conectado" : "Sin conectar"}
                  </Badge>
                </div>
                {!connection.configured && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Credenciales OAuth pendientes de configuración.
                  </p>
                )}
              </div>
              <ConnectionButton
                provider={connection.provider}
                connected={connection.connected}
                configured={connection.configured}
                encryptionConfigured={encryptionConfigured}
                redirectTo={redirectTo}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
