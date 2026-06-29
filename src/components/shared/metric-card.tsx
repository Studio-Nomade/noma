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
    <div
      className={cn("border-border bg-card rounded-xl border p-5", className)}
    >
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </p>
      <p className="font-heading mt-2 text-3xl font-semibold">{value}</p>
      {subtext && (
        <p className="text-muted-foreground mt-1 text-xs">{subtext}</p>
      )}
    </div>
  );
}
