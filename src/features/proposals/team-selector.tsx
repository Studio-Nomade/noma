"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  addProposalTeamMember,
  addManualProposalTeamMember,
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
  const [manualOpen, setManualOpen] = useState(false);

  const inTeam = new Set(team.map((t) => t.memberId));
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

  function addManual(formData: FormData) {
    formData.set("proposalId", proposalId);
    startTransition(async () => {
      const res = await addManualProposalTeamMember(formData);
      if (res.ok) {
        setManualOpen(false);
        toast.success("Integrante agregado");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-medium">
          Equipo del proyecto ({team.length})
        </h2>
        <div className="flex flex-wrap justify-end gap-2">
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
          <Dialog open={manualOpen} onOpenChange={setManualOpen}>
            <DialogTrigger
              render={
                <Button type="button" variant="outline" size="sm">
                  <Plus className="size-4" />
                  Integrante externo
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agregar integrante manualmente</DialogTitle>
              </DialogHeader>
              <form action={addManual} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="manual-name">Nombre</Label>
                  <Input id="manual-name" name="name" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-role">Rol en el proyecto</Label>
                  <Input id="manual-role" name="roleTitle" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-photo">Foto</Label>
                  <Input
                    id="manual-photo"
                    name="photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                  />
                  <p className="text-muted-foreground text-xs">
                    JPG, PNG o WEBP · máximo 5 MB.
                  </p>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Agregando…" : "Agregar al equipo"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
                <p className="truncate text-sm font-medium">{t.name}</p>
                <Input
                  value={roles[t.id] ?? ""}
                  placeholder="Rol en el proyecto"
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
