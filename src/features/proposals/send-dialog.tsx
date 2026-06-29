"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendProposalEmail } from "./send-actions";

type Template = { id: string; name: string; subject: string; body: string };
type Contact = { email: string; name: string | null };
type Vars = Record<string, string>;

function substitute(text: string, vars: Vars) {
  return text.replace(/{{\s*(\w+)\s*}}/g, (_, k) => vars[k] ?? "");
}

export function SendProposalDialog({
  proposalId,
  senderEmail,
  contacts,
  teamEmails,
  templates,
  vars,
  trigger,
}: {
  proposalId: string;
  senderEmail: string;
  contacts: Contact[];
  teamEmails: string[];
  templates: Template[];
  vars: Vars;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState<string[]>(
    contacts.length ? [contacts[0].email] : [],
  );
  const [cc, setCc] = useState(teamEmails.join(", "));
  const first = templates[0];
  const [subject, setSubject] = useState(
    first
      ? substitute(first.subject, vars)
      : `Propuesta · ${vars.proyecto ?? ""}`,
  );
  const [body, setBody] = useState(first ? substitute(first.body, vars) : "");

  function applyTemplate(id: string | null) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSubject(substitute(t.subject, vars));
    setBody(substitute(t.body, vars));
  }

  function toggleTo(email: string) {
    setTo((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email],
    );
  }

  async function send() {
    setSending(true);
    const res = await sendProposalEmail(proposalId, {
      to,
      cc: cc
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      subject,
      body,
    });
    setSending(false);
    if (res.ok) {
      toast.success("Propuesta enviada");
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
          <DialogTitle>Enviar propuesta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-muted-foreground text-xs">
            Remitente: <span className="text-foreground">{senderEmail}</span> ·
            se adjunta el PDF de la propuesta
          </div>

          <div className="space-y-1.5">
            <Label>Destinatarios (contactos del cliente)</Label>
            {contacts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Este cliente no tiene contactos. Agrégalos en su ficha.
              </p>
            ) : (
              <div className="space-y-1.5">
                {contacts.map((c) => (
                  <label
                    key={c.email}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={to.includes(c.email)}
                      onCheckedChange={() => toggleTo(c.email)}
                    />
                    <span>
                      {c.name ? `${c.name} · ` : ""}
                      {c.email}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>CC (copia al equipo)</Label>
            <Input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="correos separados por coma"
            />
          </div>

          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label>Plantilla</Label>
              <Select onValueChange={(v) => applyTemplate(v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Aplicar plantilla…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Asunto</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cuerpo</Label>
            <Textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={send} disabled={sending || to.length === 0}>
            <Send className="size-4" />
            {sending ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
