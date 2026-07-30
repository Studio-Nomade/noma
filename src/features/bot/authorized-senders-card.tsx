"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  MessageCircleMore,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addAuthorizedSender,
  ensureBotChannel,
  revokeAuthorizedSender,
} from "./channels";

type Channel = {
  id: string;
  status: string;
  senders: {
    id: string;
    displayName: string;
    phone: string;
    profile: string;
  }[];
};

type Contact = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string | null;
};

export function AuthorizedSendersCard({
  projectId,
  channel,
  contacts,
}: {
  projectId: string;
  channel: Channel | null;
  contacts: Contact[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [contactId, setContactId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [profile, setProfile] = useState("");

  function generateAgent() {
    startTransition(async () => {
      const result = await ensureBotChannel(projectId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Agente generado para este proyecto.");
      router.refresh();
    });
  }

  function selectContact(id: string) {
    setContactId(id);
    const contact = contacts.find((item) => item.id === id);
    if (!contact) return;
    setDisplayName(contact.name ?? "");
    setPhone(contact.phone ?? "");
    setProfile(contact.role ?? "");
  }

  function addSender(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!channel) return;
    startTransition(async () => {
      const result = await addAuthorizedSender(channel.id, {
        clientContactId: contactId,
        displayName,
        phone,
        profile,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setContactId("");
      setDisplayName("");
      setPhone("");
      setProfile("");
      toast.success("Número acreditado correctamente.");
      router.refresh();
    });
  }

  function revoke(senderId: string) {
    startTransition(async () => {
      const result = await revokeAuthorizedSender(senderId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Acceso revocado.");
      router.refresh();
    });
  }

  return (
    <section className="glass rounded-xl p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading flex items-center gap-2 font-medium">
            <MessageCircleMore className="size-4" />
            Agente de WhatsApp
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Acredita las personas que pueden enviar solicitudes para este
            proyecto.
          </p>
        </div>
        {channel && (
          <Badge variant={channel.status === "active" ? "secondary" : "outline"}>
            {channel.status === "active" ? "Activo" : "Pausado"}
          </Badge>
        )}
      </div>

      {!channel ? (
        <div className="border-border bg-muted/30 rounded-lg border p-5">
          <Bot className="text-muted-foreground mb-3 size-7" />
          <p className="font-medium">El proyecto aún no tiene agente</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Generarlo crea el canal privado que vinculará remitentes, contexto y
            solicitudes con este proyecto.
          </p>
          <Button
            type="button"
            className="mt-4"
            disabled={pending}
            onClick={generateAgent}
          >
            <ShieldCheck className="size-4" />
            {pending ? "Generando…" : "Generar agente"}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium">Remitentes acreditados</h3>
            {channel.senders.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-sm">
                Todavía no hay números autorizados.
              </p>
            ) : (
              <div className="mt-3 grid gap-2">
                {channel.senders.map((sender) => (
                  <div
                    key={sender.id}
                    className="border-border flex items-center justify-between gap-4 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {sender.displayName}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {sender.profile} · {sender.phone}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      aria-label={`Revocar a ${sender.displayName}`}
                      onClick={() => revoke(sender.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={addSender}
            className="border-border space-y-4 border-t pt-5"
          >
            <div>
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <UserPlus className="size-4" />
                Acreditar un número
              </h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Puedes vincular un contacto existente o ingresar un remitente
                independiente.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="bot-contact">Contacto del cliente</Label>
                <select
                  id="bot-contact"
                  value={contactId}
                  onChange={(event) => selectContact(event.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">Número independiente</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name || contact.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bot-display-name">Nombre</Label>
                <Input
                  id="bot-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Nombre de la contraparte"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bot-profile">Perfil</Label>
                <Input
                  id="bot-profile"
                  value={profile}
                  onChange={(event) => setProfile(event.target.value)}
                  placeholder="Marketing, contraparte…"
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="bot-phone">WhatsApp en formato E.164</Label>
                <Input
                  id="bot-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+56912345678"
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={pending}>
              <ShieldCheck className="size-4" />
              {pending ? "Guardando…" : "Acreditar remitente"}
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}
