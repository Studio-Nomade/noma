"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { sendKickoff } from "./kickoff-action";

type Contact = { email: string; name: string | null };

export function KickoffDialog({
  proposalId,
  senderEmail,
  contacts,
  defaultBody,
  trigger,
}: {
  proposalId: string;
  senderEmail: string;
  contacts: Contact[];
  defaultBody: string;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState<string[]>(contacts.length ? [contacts[0].email] : []);
  const [cc, setCc] = useState("");
  const [body, setBody] = useState(defaultBody);

  function toggle(email: string) {
    setTo((p) => (p.includes(email) ? p.filter((e) => e !== email) : [...p, email]));
  }

  async function send() {
    setSending(true);
    const res = await sendKickoff(proposalId, {
      to,
      cc: cc.split(",").map((s) => s.trim()).filter(Boolean),
      body,
    });
    setSending(false);
    if (res.ok) {
      toast.success("Inicio oficial enviado");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enviar inicio oficial del proyecto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground text-xs">
            Remitente: <span className="text-foreground">{senderEmail}</span> · se
            adjuntan la propuesta y el SLA en PDF.
          </p>

          <div className="space-y-1.5">
            <Label>Destinatarios (contactos del cliente)</Label>
            {contacts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Este cliente no tiene contactos. Agrégalos en su ficha.
              </p>
            ) : (
              contacts.map((c) => (
                <label key={c.email} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={to.includes(c.email)} onCheckedChange={() => toggle(c.email)} />
                  <span>
                    {c.name ? `${c.name} · ` : ""}
                    {c.email}
                  </span>
                </label>
              ))
            )}
          </div>

          <div className="space-y-1.5">
            <Label>CC (equipo)</Label>
            <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="correos separados por coma" />
          </div>

          <div className="space-y-1.5">
            <Label>Cuerpo</Label>
            <Textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={send} disabled={sending || to.length === 0}>
            <Rocket className="size-4" />
            {sending ? "Enviando…" : "Enviar inicio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
