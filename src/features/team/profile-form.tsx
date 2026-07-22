"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvatarCircle } from "@/components/shared/avatar-circle";
import { AREAS, AREA_LABELS, type Area } from "@/types/enums";
import { updateMyProfile } from "./profile-actions";
import { buildSignatureHtml } from "./signature";

const NO_AREA = "__none__";

export function ProfileForm({
  member,
  email,
}: {
  member: {
    name: string;
    roleTitle: string | null;
    area: Area | null;
    phone: string | null;
    birthDate: string | null;
    photoUrl: string | null;
    teamRole: string;
  };
  email: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(member.name);
  const [roleTitle, setRoleTitle] = useState(member.roleTitle ?? "");
  const [area, setArea] = useState<string>(member.area ?? NO_AREA);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [birthDate, setBirthDate] = useState(member.birthDate ?? "");
  const [photoUrl, setPhotoUrl] = useState(member.photoUrl ?? "");

  // Vista previa en vivo de la firma generada con los datos actuales.
  const signaturePreview = buildSignatureHtml({ name, roleTitle, phone });

  async function save() {
    setSaving(true);
    const res = await updateMyProfile({
      name,
      roleTitle,
      area: area === NO_AREA ? null : (area as Area),
      phone,
      birthDate,
      photoUrl,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Perfil actualizado");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <AvatarCircle
          name={name || email}
          photoUrl={photoUrl || null}
          className="size-16 text-lg"
        />
        <div>
          <p className="text-sm font-medium">{name || "—"}</p>
          <p className="text-muted-foreground text-xs">{email}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px] tracking-wide uppercase">
            {member.teamRole === "admin" ? "Administrador" : "Colaborador"} ·
            Conectado con Google
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Cargo</Label>
          <Input
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            placeholder="Ej: Dirección Creativa"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Área</Label>
          <Select value={area} onValueChange={(v) => setArea(v ?? NO_AREA)}>
            <SelectTrigger className="w-full">
              {/* base-ui muestra el valor crudo; se mapea al label legible. */}
              <SelectValue>
                {(v: string) =>
                  v && v !== NO_AREA ? AREA_LABELS[v as Area] : "Sin área"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_AREA}>Sin área</SelectItem>
              {AREAS.map((a) => (
                <SelectItem key={a} value={a}>
                  {AREA_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Teléfono</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+569 1234 5678"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>URL de foto</Label>
          <Input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Fecha de nacimiento</Label>
          <Input
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Solo se usa para recordar cumpleaños en el dashboard.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Firma de correo</Label>
        <p className="text-muted-foreground text-xs">
          Se arma sola con tus datos y la marca del estudio. Así se verá en los
          correos que envíes desde la plataforma:
        </p>
        <div className="border-border rounded-lg border bg-white p-4">
          {/* Vista previa: el HTML lo genera buildSignatureHtml a partir de los
              datos de arriba (constructor guiado, sin editar HTML a mano). */}
          <div dangerouslySetInnerHTML={{ __html: signaturePreview }} />
        </div>
      </div>

      <div className="border-border flex justify-end border-t pt-4">
        <Button onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
