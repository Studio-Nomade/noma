"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { createProposalVersion } from "./actions";

type Version = {
  id: string;
  version: number;
  status: string;
  createdAt: Date | string | null;
  authorName: string | null;
};

function when(date: Date | string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ProposalVersions({
  currentId,
  versions,
}: {
  currentId: string;
  versions: Version[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function newVersion() {
    startTransition(async () => {
      const res = await createProposalVersion(currentId);
      if (res.ok) {
        toast.success("Nueva versión creada");
        router.push(`/proposals/${res.data.id}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading text-sm font-medium">Versiones</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={newVersion}
          disabled={pending}
        >
          <GitBranch className="size-4" />
          {pending ? "Creando…" : "Nueva versión"}
        </Button>
      </div>
      <ul className="space-y-1">
        {versions.map((v) => {
          const isCurrent = v.id === currentId;
          return (
            <li key={v.id}>
              <Link
                href={`/proposals/${v.id}`}
                className={cn(
                  "flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm",
                  isCurrent ? "bg-accent font-medium" : "hover:bg-accent/50",
                )}
              >
                <span className="min-w-0">
                  <span className="block">
                    v{v.version}
                    {isCurrent && " · actual"}
                  </span>
                  {/* Autoría: quién creó cada versión y cuándo (resuelve el caso
                      "la v01 la hizo Ana y no había cómo saberlo"). */}
                  <span className="text-muted-foreground block truncate text-xs font-normal">
                    {v.authorName ?? "—"}
                    {when(v.createdAt) && ` · ${when(v.createdAt)}`}
                  </span>
                </span>
                <StatusBadge value={v.status} size="xs" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
