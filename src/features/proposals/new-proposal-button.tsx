"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createProposal } from "./actions";

export function NewProposalButton({
  projectId,
  variant = "default",
}: {
  projectId: string;
  variant?: "default" | "outline";
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const res = await createProposal(projectId);
      if (res.ok) {
        router.push(`/proposals/${res.data.id}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button variant={variant} onClick={handleClick} disabled={pending}>
      <FileSignature className="size-4" />
      {pending ? "Creando…" : "Nueva cotización"}
    </Button>
  );
}
