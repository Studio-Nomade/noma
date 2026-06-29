"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AREAS, AREA_LABELS, type Area } from "@/types/enums";
import type { EmailTemplate } from "@/db/schema";
import { createEmailTemplate, updateEmailTemplate } from "./template-actions";

const GLOBAL = "__global__";

export function TemplateDialog({
  template,
  trigger,
}: {
  template?: EmailTemplate;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(template?.name ?? "");
  const [area, setArea] = useState<string>(template?.area ?? GLOBAL);
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(template);

  async function save() {
    setSaving(true);
    const input = {
      name,
      area: area === GLOBAL ? null : (area as Area),
      subject,
      body,
    };
    const res = isEdit
      ? await updateEmailTemplate(template!.id, input)
      : await createEmailTemplate(input);
    setSaving(false);
    if (res.ok) {
      toast.success(isEdit ? "Plantilla actualizada" : "Plantilla creada");
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
          <DialogTitle>
            {isEdit ? "Editar plantilla" : "Nueva plantilla"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Área</Label>
              <Select value={area} onValueChange={(v) => v && setArea(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GLOBAL}>Global (todas)</SelectItem>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {AREA_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
            <p className="text-muted-foreground text-xs">
              Variables: {"{{cliente}}"} · {"{{contacto}}"} · {"{{proyecto}}"} ·{" "}
              {"{{propuesta}}"} · {"{{total}}"} · {"{{remitente}}"}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
