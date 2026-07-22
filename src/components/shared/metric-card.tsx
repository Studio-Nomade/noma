import { Surface } from "@/components/shared/surface";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  subtext,
  className,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  className?: string;
}) {
  return (
    <Surface variant="raised" padding="lg" sheen className={cn(className)}>
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </p>
      <p className="font-heading mt-2 text-3xl font-semibold tracking-tight">
        {value}
      </p>
      {subtext && (
        <p className="text-muted-foreground mt-1 text-xs">{subtext}</p>
      )}
    </Surface>
  );
}
