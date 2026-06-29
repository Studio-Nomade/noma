"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LINK_TYPES, type LinkType } from "@/types/enums";
import type { ResourceLink } from "@/db/schema";
import { addProjectLink, deleteProjectLink } from "./actions";

export function ProjectLinks({
  projectId,
  links,
}: {
  projectId: string;
  links: ResourceLink[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<LinkType>("drive");

  function handleAdd() {
    if (!url.trim()) {
      toast.error("Ingresa una URL.");
      return;
    }
    startTransition(async () => {
      const res = await addProjectLink(projectId, { url, label, type });
      if (res.ok) {
        setUrl("");
        setLabel("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDelete(linkId: string) {
    startTransition(async () => {
      const res = await deleteProjectLink(linkId, projectId);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {links.length > 0 && (
        <ul className="space-y-1.5">
          {links.map((l) => (
            <li
              key={l.id}
              className="hover:bg-accent/50 group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
            >
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 text-sm"
              >
                <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate">{l.label || l.url}</span>
                <span className="text-muted-foreground text-xs uppercase">
                  {l.type}
                </span>
              </a>
              <button
                type="button"
                onClick={() => handleDelete(l.id)}
                disabled={pending}
                className="text-muted-foreground hover:text-destructive opacity-0 transition group-hover:opacity-100"
                aria-label="Eliminar link"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={type} onValueChange={(v) => v && setType(v as LinkType)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LINK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Etiqueta"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-32"
        />
        <Input
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-40 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={pending}
        >
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>
    </div>
  );
}
