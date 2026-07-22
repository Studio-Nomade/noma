import { ChevronDown } from "lucide-react";

export function MobileDetailsCard({
  title,
  subtitle,
  badge,
  children,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <details className="glass group rounded-xl md:hidden">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          {subtitle && (
            <span className="text-muted-foreground mt-0.5 block truncate text-xs">
              {subtitle}
            </span>
          )}
        </span>
        {badge}
        <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      {(children || actions) && (
        <div className="border-border space-y-3 border-t px-4 py-3 text-sm">
          {children}
          {actions && (
            <div className="border-border flex min-h-10 items-center justify-end gap-2 border-t pt-3">
              {actions}
            </div>
          )}
        </div>
      )}
    </details>
  );
}

export function MobileField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground shrink-0 text-xs">{label}</dt>
      <dd className="min-w-0 text-right text-sm">{children}</dd>
    </div>
  );
}
