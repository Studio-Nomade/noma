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
};

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
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                  isCurrent ? "bg-accent font-medium" : "hover:bg-accent/50",
                )}
              >
                <span>
                  v{v.version}
                  {isCurrent && " · actual"}
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
