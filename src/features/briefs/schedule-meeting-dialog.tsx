"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { AREAS, AREA_LABELS, type Area } from "@/types/enums";
import { scheduleBriefMeeting } from "./meeting-actions";

type TeamMember = { id: string; name: string };
type Contact = { name: string | null; email: string };

export function ScheduleMeetingDialog({
  projectId,
  projectName,
  defaultArea,
  teamMembers,
  contacts,
  trigger,
}: {
  projectId: string;
  projectName: string;
  defaultArea: Area;
  teamMembers: TeamMember[];
  contacts: Contact[];
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(`Reunión de brief · ${projectName}`);
  const [objective, setObjective] = useState("");
  const [agenda, setAgenda] = useState("");
  const [area, setArea] = useState<Area>(defaultArea);
  const [involvedAreas, setInvolvedAreas] = useState<Area[]>([]);
  const [responsibleId, setResponsibleId] = useState<string>("");
  const [internalIds, setInternalIds] = useState<string[]>([]);
  const [contactEmail, setContactEmail] = useState<string>(
    contacts[0]?.email ?? "",
  );
  const [externalEmails, setExternalEmails] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationMin, setDurationMin] = useState("45");

  function toggle<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  // Requisitos del spec para agendar (backstop en el servidor).
  const canSubmit =
    title.trim() !== "" &&
    !!area &&
    responsibleId !== "" &&
    date !== "" &&
    time !== "" &&
    (contactEmail !== "" || externalEmails.trim() !== "");

  async function submit() {
    setSaving(true);
    const primary = contacts.find((c) => c.email === contactEmail) ?? null;
    const res = await scheduleBriefMeeting({
      projectId,
      title,
      objective,
      agenda,
      area,
      areas: involvedAreas.length ? involvedAreas : [area],
      responsibleId,
      date,
      time,
      durationMin: Number(durationMin),
      internalParticipantIds: internalIds,
      externalEmails: externalEmails
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      primaryContact: primary
        ? { name: primary.name ?? undefined, email: primary.email }
        : null,
    });
    setSaving(false);
    if (res.ok) {
      if (res.data.googleConnected) {
        toast.success("Reunión agendada · evento de Google Calendar creado");
      } else {
        toast.success("Reunión agendada", {
          description:
            "No se creó el evento de Google (falta permiso de Calendar). Cierra sesión y vuelve a entrar para activarlo.",
        });
      }
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
          <DialogTitle>Agendar reunión de brief</DialogTitle>
          <DialogDescription>
            Coordina el levantamiento inicial. Si Google Calendar está conectado,
            se crea el evento con link de Meet y se invita a los participantes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Título de la reunión</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label>Objetivo de la reunión</Label>
            <Textarea
              rows={2}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Qué queremos levantar / decidir en esta reunión"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Área principal</Label>
              <Select value={area} onValueChange={(v) => setArea(v as Area)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {AREA_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Responsable comercial</Label>
              <Select
                value={responsibleId}
                onValueChange={(v) => setResponsibleId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Áreas involucradas</Label>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {AREAS.filter((a) => a !== area).map((a) => (
                <label
                  key={a}
                  className="flex cursor-pointer items-center gap-1.5 text-sm"
                >
                  <Checkbox
                    checked={involvedAreas.includes(a)}
                    onCheckedChange={() =>
                      setInvolvedAreas((p) => toggle(p, a))
                    }
                  />
                  {a}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="grid gap-1.5">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Hora</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Duración</Label>
              <Select
                value={durationMin}
                onValueChange={(v) => setDurationMin(v ?? "45")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["30", "45", "60", "90"].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {teamMembers.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Participantes internos</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {teamMembers.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-1.5 text-sm"
                  >
                    <Checkbox
                      checked={internalIds.includes(m.id)}
                      onCheckedChange={() =>
                        setInternalIds((p) => toggle(p, m.id))
                      }
                    />
                    {m.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Contacto principal del cliente</Label>
              {contacts.length > 0 ? (
                <Select
                  value={contactEmail}
                  onValueChange={(v) => setContactEmail(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.email} value={c.email}>
                        {c.name ? `${c.name} · ${c.email}` : c.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-muted-foreground py-2 text-xs">
                  Este cliente no tiene contactos. Usa correos externos.
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Correos externos (coma)</Label>
              <Input
                value={externalEmails}
                onChange={(e) => setExternalEmails(e.target.value)}
                placeholder="cliente@empresa.cl, otro@empresa.cl"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Agenda sugerida</Label>
            <Textarea
              rows={3}
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Puntos a cubrir en la reunión"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !canSubmit}>
            {saving ? "Agendando…" : "Agendar reunión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
