"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { DevBadge, devStatusLabel } from "./dev-badge";
import { setMilestoneStatus } from "./actions";
import { MILESTONE_STATUSES, type MilestoneStatus } from "./constants";

export function MilestoneStatusSelect({
  milestoneId,
  value,
}: {
  milestoneId: string;
  value: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [pending, setPending] = useState(false);

  async function update(next: string | null) {
    if (!next || next === current || pending) return;
    const previous = current;
    setCurrent(next);
    setPending(true);
    try {
      const result = await setMilestoneStatus({
        milestoneId,
        status: next as MilestoneStatus,
      });
      if (!result.ok) {
        setCurrent(previous);
        toast.error(result.error);
        return;
      }
      toast.success(`Hito → ${devStatusLabel(next)}`);
      router.refresh();
    } catch {
      setCurrent(previous);
      toast.error("No se pudo guardar el cambio. Intenta nuevamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Select value={current} onValueChange={update} disabled={pending}>
      <SelectTrigger
        aria-label="Estado del hito"
        size="sm"
        className="h-7 w-auto border-0 bg-transparent px-1 shadow-none"
      >
        <DevBadge value={current} size="xs" />
      </SelectTrigger>
      <SelectContent align="end">
        {MILESTONE_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {devStatusLabel(s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
