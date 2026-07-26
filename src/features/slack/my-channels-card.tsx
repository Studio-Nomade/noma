import { ExternalLink, Hash, MessageCircleMore } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConnectionButton } from "@/features/integrations/connection-button";
import type { IntegrationOverview } from "@/features/integrations/queries";
import type { MySlackChannelsResult } from "./my-channels";

export function MySlackChannelsCard({
  result,
  connection,
  encryptionConfigured,
}: {
  result: MySlackChannelsResult;
  connection: IntegrationOverview["personal"][number];
  encryptionConfigured: boolean;
}) {
  return (
    <section className="glass mt-8 rounded-xl p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading flex items-center gap-2 text-sm font-medium">
            <MessageCircleMore className="size-4" />
            Slack
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Tus canales y mensajes directos, priorizados por no leídos.
          </p>
        </div>
        <ConnectionButton
          provider="slack"
          connected={result.connected && connection.connected}
          configured={connection.configured}
          encryptionConfigured={encryptionConfigured}
          redirectTo="/"
        />
      </div>

      {!result.connected ? (
        <div className="border-border rounded-lg border border-dashed p-5">
          <p className="text-sm font-medium">Slack personal no disponible</p>
          <p className="text-muted-foreground mt-1 text-xs">{result.reason}</p>
        </div>
      ) : result.channels.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed p-5">
          <p className="text-sm font-medium">No hay conversaciones disponibles</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Slack no devolvió canales o mensajes directos para esta cuenta.
          </p>
        </div>
      ) : (
        <ul className="divide-border divide-y">
          {result.channels.map((channel) => (
            <li key={channel.id}>
              <a
                href={channel.url}
                target="_blank"
                rel="noreferrer"
                className="hover:bg-accent/50 flex min-w-0 items-center gap-3 rounded-lg px-2 py-3 transition-colors"
              >
                <Hash className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {channel.name}
                </span>
                {channel.unread > 0 && (
                  <Badge variant="secondary">
                    {channel.unread.toLocaleString("es-CL")} sin leer
                  </Badge>
                )}
                <ExternalLink className="size-3.5 shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
