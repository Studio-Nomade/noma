"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ActionResult } from "@/lib/actions";

type InlineStatusSelectProps<T extends string> = {
  entityId: string;
  value: T;
  options: readonly T[];
  label: string;
  successMessage: (value: T) => string;
  action: (id: string, value: T) => Promise<ActionResult>;
};

export function InlineStatusSelect<T extends string>({
  entityId,
  value,
  options,
  label,
  successMessage,
  action,
}: InlineStatusSelectProps<T>) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [pending, setPending] = useState(false);

  useEffect(() => setCurrent(value), [value]);

  async function update(nextValue: T | null) {
    if (!nextValue || nextValue === current || pending) return;
    const previous = current;
    setCurrent(nextValue);
    setPending(true);

    try {
      const result = await action(entityId, nextValue);
      if (!result.ok) {
        setCurrent(previous);
        toast.error(result.error);
        return;
      }
      toast.success(successMessage(nextValue));
      router.refresh();
    } catch {
      setCurrent(previous);
      toast.error("No se pudo guardar el cambio. Intenta nuevamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Select
        value={current}
        onValueChange={(next) => void update(next as T | null)}
        disabled={pending}
      >
        <SelectTrigger
          size="sm"
          aria-label={label}
          className="h-auto min-w-0 border-0 bg-transparent p-0 shadow-none focus-visible:ring-2"
        >
          <StatusBadge value={current} size="xs" />
        </SelectTrigger>
        <SelectContent
          align="start"
          onClick={(event) => event.stopPropagation()}
        >
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              <StatusBadge value={option} size="xs" />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
