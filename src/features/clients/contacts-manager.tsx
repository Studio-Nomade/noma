"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClientContact } from "@/db/schema";
import { addClientContact, deleteClientContact } from "./contact-actions";

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

  function add() {
    if (!email.trim()) {
      toast.error("Ingresa un email.");
      return;
    }
    startTransition(async () => {
      const res = await addClientContact(clientId, { name, email, role });
      if (res.ok) {
        setName("");
        setEmail("");
        setRole("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
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
            <li key={c.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {c.isPrimary && <Star className="size-3 fill-current" />}
                  {c.name || c.email}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {c.email}
                  {c.role ? ` · ${c.role}` : ""}
                </p>
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
        <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Cargo" value={role} onChange={(e) => setRole(e.target.value)} />
      </div>
      <Button size="sm" variant="outline" onClick={add} disabled={pending}>
        <Plus className="size-4" />
        Agregar contacto
      </Button>
    </div>
  );
}
