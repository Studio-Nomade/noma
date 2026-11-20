"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, RefreshCw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SLACK_EVENT_KINDS, eventEnabled, type SlackEventKind } from "./format";
import {
  runSlackLinkWebhooks,
  setSlackLinkActive,
  setSlackLinkEvent,
  testSlackLink,
} from "./link-actions";
import {
  LinkDialog,
  type ChannelOption,
  type ProjectOption,
} from "./link-dialog";

const EVENT_LABELS: Record<SlackEventKind, string> = {
  mention: "Menciones",
  reopened: "Reabierta",
  state_change: "Estado",
  assigned: "Asignación",
  completed: "Cerrada",
  new_task: "Nueva",
};

const WEBHOOK_LABEL = {
  vivo: { text: "Vivo", variant: "secondary" },
  caido: { text: "Caído", variant: "destructive" },
  sin_registrar: { text: "Sin registrar", variant: "outline" },
} as const;

export type BoardLink = {
  id: string;
  asanaProjectGid: string;
  asanaProjectName: string;
  slackChannelId: string;
  slackChannelName: string;
  folioPrefix: string | null;
  events: Partial<Record<string, boolean>>;
  active: boolean;
  webhook: keyof typeof WEBHOOK_LABEL;
  lastNotifiedAt: string | null;
};

const dateFmt = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function SlackLinksBoard({
  links,
  projects,
  channels,
  botConfigured,
}: {
  links: BoardLink[];
  projects: ProjectOption[];
  channels: ChannelOption[] | null;
  botConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const channelById = new Map((channels ?? []).map((c) => [c.id, c]));

  function run(task: () => Promise<void>) {
    startTransition(async () => {
      await task();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {!botConfigured ? (
        <p className="text-destructive text-sm">
          Falta SLACK_BOT_TOKEN: los vínculos se guardan, pero no se publica
          ningún aviso hasta configurar el bot de Noma.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <LinkDialog
          projects={projects}
          channels={channels}
          trigger={
            <Button>
              <Plus className="size-4" />
              Vincular proyecto
            </Button>
          }
        />
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const result = await runSlackLinkWebhooks();
              if (!result.ok) toast.error(result.error);
              else
                toast.success(
                  `Webhooks: ${result.data.ok} vivos, ${result.data.registered} registrados${result.data.errors ? `, ${result.data.errors} con error` : ""}.`,
                );
            })
          }
        >
          <RefreshCw className="size-4" />
          Revisar webhooks
        </Button>
      </div>

      <div className="glass overflow-x-auto rounded-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proyecto</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Avisos</TableHead>
              <TableHead>Webhook</TableHead>
              <TableHead>Último aviso</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => {
              const channel = channelById.get(link.slackChannelId);
              const webhook = WEBHOOK_LABEL[link.webhook];
              return (
                <TableRow
                  key={link.id}
                  className={link.active ? undefined : "opacity-60"}
                >
                  <TableCell className="max-w-64 font-medium whitespace-normal">
                    {link.asanaProjectName}
                    {link.folioPrefix ? (
                      <span className="text-muted-foreground ml-1 text-xs">
                        {link.folioPrefix}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="text-sm">#{link.slackChannelName}</span>
                    {channel?.isPrivate && !channel.isMember ? (
                      <p className="text-destructive text-xs">
                        Invita a @Noma al canal
                      </p>
                    ) : null}
                    {channels && !channel ? (
                      <p className="text-destructive text-xs">
                        El bot no ve el canal
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 lg:grid-cols-3">
                      {SLACK_EVENT_KINDS.map((kind) => (
                        <label
                          key={kind}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <Checkbox
                            checked={eventEnabled(link.events, kind)}
                            disabled={pending}
                            onCheckedChange={(checked) =>
                              run(async () => {
                                const result = await setSlackLinkEvent({
                                  id: link.id,
                                  kind,
                                  enabled: Boolean(checked),
                                });
                                if (!result.ok) toast.error(result.error);
                              })
                            }
                          />
                          {EVENT_LABELS[kind]}
                        </label>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={link.active ? webhook.variant : "outline"}>
                      {link.active ? webhook.text : "Apagado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {link.lastNotifiedAt
                      ? dateFmt.format(new Date(link.lastNotifiedAt))
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending || !link.active}
                        onClick={() =>
                          run(async () => {
                            const result = await testSlackLink(link.id);
                            if (!result.ok) toast.error(result.error);
                            else
                              toast.success(
                                `Aviso de prueba en #${link.slackChannelName}`,
                              );
                          })
                        }
                      >
                        <Send className="size-3.5" />
                        Probar
                      </Button>
                      <LinkDialog
                        projects={projects}
                        channels={channels}
                        initial={{
                          projectGid: link.asanaProjectGid,
                          projectName: link.asanaProjectName,
                          channelId: link.slackChannelId,
                          channelName: link.slackChannelName,
                          folioPrefix: link.folioPrefix,
                        }}
                        trigger={
                          <Button size="sm" variant="ghost">
                            Canal
                          </Button>
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          run(async () => {
                            const result = await setSlackLinkActive({
                              id: link.id,
                              active: !link.active,
                            });
                            if (!result.ok) toast.error(result.error);
                            else if (result.data.warning)
                              toast.warning(result.data.warning);
                          })
                        }
                      >
                        {link.active ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
