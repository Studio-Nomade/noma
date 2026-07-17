"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-medium">
          Equipo del proyecto ({team.length})
        </h2>
        <Select value="" onValueChange={add} disabled={available.length === 0}>
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
