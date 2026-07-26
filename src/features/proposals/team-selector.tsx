"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvatarCircle } from "@/components/shared/avatar-circle";
import type { ProposalTeamRow, TeamSelectRow } from "./queries";
import {
  addProposalCustomMember,
  addProposalTeamMember,
  removeProposalTeamMember,
  updateProposalTeamRole,
} from "./actions";

export function TeamSelector({
  proposalId,
  team,
  members,
}: {
  proposalId: string;
  team: ProposalTeamRow[];
  members: TeamSelectRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [roles, setRoles] = useState<Record<string, string>>(
    Object.fromEntries(team.map((t) => [t.id, t.roleInProject ?? ""])),
  );

  // Formulario de persona externa (freelance).
  const [showExternal, setShowExternal] = useState(false);
  const [extName, setExtName] = useState("");
  const [extRole, setExtRole] = useState("");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const inTeam = new Set(team.map((t) => t.memberId).filter(Boolean));
  const available = members.filter((m) => !inTeam.has(m.id));

  function add(memberId: string | null) {
    if (!memberId) return;
    startTransition(async () => {
      const res = await addProposalTeamMember(proposalId, memberId);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }
  function remove(rowId: string) {
    startTransition(async () => {
      const res = await removeProposalTeamMember(rowId, proposalId);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }
  function saveRole(rowId: string) {
    startTransition(async () => {
      const res = await updateProposalTeamRole(
        rowId,
        proposalId,
        roles[rowId] ?? "",
      );
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  function addExternal() {
    if (!extName.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    const formData = new FormData();
    formData.set("name", extName.trim());
    formData.set("roleTitle", extRole.trim());
    const file = fileRef.current?.files?.[0];
    if (file) formData.set("photo", file);

    startTransition(async () => {
      const res = await addProposalCustomMember(proposalId, formData);
      if (res.ok) {
        setExtName("");
        setExtRole("");
        setPhotoName(null);
        setShowExternal(false);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-medium">
          Equipo del proyecto ({team.length})
        </h2>
        <div className="flex items-center gap-2">
          <Select
            value=""
            onValueChange={add}
            disabled={available.length === 0}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="+ Agregar integrante" />
            </SelectTrigger>
            <SelectContent>
              {available.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowExternal((v) => !v)}
          >
            <UserPlus className="size-4" />
            Persona externa
          </Button>
        </div>
      </div>

      {/* Formulario de freelance externo */}
      {showExternal && (
        <div className="glass-hairline space-y-3 rounded-xl p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Nombre"
              value={extName}
              onChange={(e) => setExtName(e.target.value)}
            />
            <Input
              placeholder="Cargo (ej. Freelance de apoyo)"
              value={extRole}
              onChange={(e) => setExtRole(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                setPhotoName(e.target.files?.[0]?.name ?? null)
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              {photoName ? "Cambiar foto" : "Subir foto"}
            </Button>
            {photoName && (
              <span className="text-muted-foreground max-w-40 truncate text-xs">
                {photoName}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowExternal(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={addExternal}
                disabled={pending}
              >
                Agregar
              </Button>
            </div>
          </div>
        </div>
      )}

      {team.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Agrega los integrantes que liderarán el proyecto; aparecerán en el
          deck.
        </p>
      ) : (
        <ul className="space-y-3">
          {team.map((t) => (
            <li key={t.id} className="flex items-center gap-3">
              <AvatarCircle
                name={t.name}
                photoUrl={t.photoUrl}
                className="size-10 shrink-0 text-xs"
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium">
                  {t.name}
                  {t.isExternal && (
                    <span className="glass-hairline text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]">
                      Externo
                    </span>
                  )}
                </p>
                <Input
                  value={roles[t.id] ?? ""}
                  placeholder={t.roleTitle ?? "Rol en el proyecto"}
                  onChange={(e) =>
                    setRoles((r) => ({ ...r, [t.id]: e.target.value }))
                  }
                  onBlur={() => saveRole(t.id)}
                  className="mt-1 h-7 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                disabled={pending}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Quitar"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
