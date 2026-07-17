"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROPOSAL_STATUSES, type ProposalStatus } from "@/types/enums";
import { setProposalStatus } from "./actions";

export function ProposalStatusSelect({
  id,
  status,
}: {
  id: string;
  status: ProposalStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(value: string | null) {
    if (!value) return;
    startTransition(async () => {
      const res = await setProposalStatus(id, value as ProposalStatus);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  return (
    <Select value={status} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROPOSAL_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
