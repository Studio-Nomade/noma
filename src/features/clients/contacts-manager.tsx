"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ClientContact } from "@/db/schema";
import {
  CONTACT_PROFILES,
  CONTACT_PROFILE_LABELS,
  CONTACT_PROFILE_HINTS,
  type ContactProfile,
} from "@/types/enums";
import {
  addClientContact,
  deleteClientContact,
  setContactProfiles,
} from "./contact-actions";

/** Chips de perfil: complementarios, se marcan/desmarcan de forma independiente. */
function ProfilePicker({
  value,
  onToggle,
  disabled,
}: {
  value: ContactProfile[];
  onToggle: (p: ContactProfile) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CONTACT_PROFILES.map((p) => {
        const on = value.includes(p);
        return (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(p)}
            title={CONTACT_PROFILE_HINTS[p]}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
              on
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {CONTACT_PROFILE_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}

export function ContactsManager({
  clientId,
  contacts,
}: {
  clientId: string;
  contacts: ClientContact[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [profiles, setProfiles] = useState<ContactProfile[]>([]);

  function toggleNew(p: ContactProfile) {
    setProfiles((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  function add() {
    if (!email.trim()) {
      toast.error("Ingresa un email.");
      return;
    }
    startTransition(async () => {
      const res = await addClientContact(clientId, {
        name,
        email,
        role,
        profiles,
      });
      if (res.ok) {
        setName("");
        setEmail("");
        setRole("");
        setProfiles([]);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function toggleExisting(c: ClientContact, p: ContactProfile) {
    const current = (c.profiles ?? []) as ContactProfile[];
    const next = current.includes(p)
      ? current.filter((x) => x !== p)
      : [...current, p];
    startTransition(async () => {
      const res = await setContactProfiles(c.id, clientId, next);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteClientContact(id, clientId);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {contacts.length > 0 && (
        <ul className="divide-border divide-y">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2 py-2.5">
              <div className="min-w-0 space-y-1.5">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {c.isPrimary && <Star className="size-3 fill-current" />}
                  {c.name || c.email}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {c.email}
                  {c.role ? ` · ${c.role}` : ""}
                </p>
                <ProfilePicker
                  value={(c.profiles ?? []) as ContactProfile[]}
                  onToggle={(p) => toggleExisting(c, p)}
                  disabled={pending}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(c.id)}
                disabled={pending}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Eliminar contacto"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          placeholder="Cargo"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs">
          Perfiles del contacto (puede tener varios):
        </p>
        <ProfilePicker value={profiles} onToggle={toggleNew} disabled={pending} />
      </div>

      <Button size="sm" variant="outline" onClick={add} disabled={pending}>
        <Plus className="size-4" />
        Agregar contacto
      </Button>
    </div>
  );
}
