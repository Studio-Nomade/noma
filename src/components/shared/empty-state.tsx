import type { LucideIcon } from "lucide-react";
import { Surface } from "@/components/shared/surface";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Surface
      variant="flat"
      padding="none"
      className="flex flex-col items-center justify-center border-dashed px-6 py-16 text-center"
    >
      <Icon className="text-muted-foreground/60 size-10" strokeWidth={1.5} />
      <h3 className="font-heading mt-4 text-base font-medium">{title}</h3>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </Surface>
  );
}
