"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSlackLink } from "./link-actions";

export type ProjectOption = { gid: string; name: string };
export type ChannelOption = {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
};

const selectClass =
  "border-input bg-background h-9 w-full rounded-md border px-2 text-sm";

/** Vincular un proyecto a un canal, o cambiar el canal de uno vinculado. */
export function LinkDialog({
  trigger,
  projects,
  channels,
  initial,
}: {
  trigger: ReactElement;
  projects: ProjectOption[];
  channels: ChannelOption[] | null;
  initial?: {
    projectGid: string;
    projectName: string;
    channelId: string;
    channelName: string;
    folioPrefix: string | null;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [projectGid, setProjectGid] = useState(initial?.projectGid ?? "");
  const [channelId, setChannelId] = useState(initial?.channelId ?? "");
  const [folio, setFolio] = useState(initial?.folioPrefix ?? "");

  const channel = channels?.find((c) => c.id === channelId) ?? null;
  const projectName =
    projects.find((p) => p.gid === projectGid)?.name ??
    initial?.projectName ??
    "";

  function submit() {
    if (!projectGid || !channelId) {
      toast.error("Elige el proyecto y el canal.");
      return;
    }
    startTransition(async () => {
      const result = await saveSlackLink({
        asanaProjectGid: projectGid,
        asanaProjectName: projectName,
        slackChannelId: channelId,
        slackChannelName: channel?.name ?? initial?.channelName ?? channelId,
        folioPrefix: folio,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data.warning) toast.warning(result.data.warning);
      else toast.success(`${projectName} → #${channel?.name ?? ""}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Cambiar canal" : "Vincular proyecto"}
          </DialogTitle>
          <DialogDescription>
            Los avisos de Asana de este proyecto los publica el bot Noma en el
            canal elegido.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sl-project">Proyecto de Asana</Label>
            {initial ? (
              <p className="text-sm font-medium">{initial.projectName}</p>
            ) : (
              <select
                id="sl-project"
                value={projectGid}
                onChange={(e) => setProjectGid(e.target.value)}
                className={selectClass}
              >
                <option value="">Elige un proyecto…</option>
                {projects.map((p) => (
                  <option key={p.gid} value={p.gid}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sl-channel">Canal de Slack</Label>
            {channels ? (
              <select
                id="sl-channel"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className={selectClass}
              >
                <option value="">Elige un canal…</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.isPrivate ? "🔒 " : "#"}
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-muted-foreground text-sm">
                No se pudieron leer los canales: falta SLACK_BOT_TOKEN o los
                permisos channels:read y groups:read.
              </p>
            )}
            {channel?.isPrivate && !channel.isMember ? (
              <p className="text-destructive text-xs">
                Canal privado: invita a @Noma para que pueda publicar.
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sl-folio">Prefijo de folio (opcional)</Label>
            <Input
              id="sl-folio"
              value={folio}
              maxLength={10}
              onChange={(e) => setFolio(e.target.value)}
              placeholder="G360"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !channels}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
